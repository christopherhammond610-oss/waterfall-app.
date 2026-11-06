import { DEFAULT_PAYOUT_COUNTRY, isPayoutCountry } from "@/lib/countries";
import { handle, HttpError, json, readJson, requireUser, siteUrl } from "@/lib/server/http";
import { getPayoutAccount } from "@/lib/server/payouts";
import { getStripe } from "@/lib/server/stripe";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

/**
 * Starts (or resumes) Stripe Connect onboarding for the signed-in creator.
 * Creates the creator's connected account on first use (Accounts v2, which
 * Stripe requires for new Connect integrations) and returns a one-time
 * Stripe-hosted onboarding URL.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const stripe = getStripe();

    let account = await getPayoutAccount(user.id);
    if (!account) {
      // Stripe needs the country up front (it can't be changed later).
      const { country = DEFAULT_PAYOUT_COUNTRY } = await readJson<{ country: string }>(request);
      if (!isPayoutCountry(country)) throw new HttpError(400, "Please choose a supported payout country.");

      const created = await stripe.v2.core.accounts.create(
        {
          contact_email: user.email ?? undefined,
          identity: { country },
          // Express dashboard for the creator; the platform pays Stripe fees and covers losses.
          dashboard: "express",
          defaults: {
            responsibilities: { fees_collector: "application", losses_collector: "application" },
          },
          // "Recipient": the creator only receives the 80% transfer from destination charges.
          configuration: {
            recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
          },
          metadata: { waterfall_user_id: user.id },
        },
        // Retrying within 24h returns the same account instead of creating a duplicate.
        { idempotencyKey: `waterfall-connect-recipient-${user.id}-${country}` },
      );

      const { error } = await getSupabaseAdmin()
        .from("stripe_accounts")
        .insert({ user_id: user.id, stripe_account_id: created.id });
      // 23505: a parallel request already saved it.
      if (error && error.code !== "23505") throw new Error(`stripe_accounts insert failed: ${error.message}`);

      account = await getPayoutAccount(user.id);
      if (!account) throw new Error("Payout account was not saved.");
    }

    const base = siteUrl(request);
    const link = await stripe.v2.core.accountLinks.create({
      account: account.stripe_account_id,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          refresh_url: `${base}/hub?payouts=refresh`,
          return_url: `${base}/hub?payouts=return`,
        },
      },
    });

    return json({ url: link.url });
  });
}
