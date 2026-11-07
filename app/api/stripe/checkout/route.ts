import { CREATOR_SHARE, LOCKED_PRICE_CENTS } from "@/lib/defaults";
import { handle, HttpError, isUuid, json, readJson, requireUser, siteUrl } from "@/lib/server/http";
import { getPayoutAccount, syncPayoutAccount } from "@/lib/server/payouts";
import { getStripe } from "@/lib/server/stripe";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

const CURRENCY = "usd";
const MIN_CHARGE_CENTS = 50; // Stripe minimum for USD.
const SESSION_TTL_SECONDS = 30 * 60; // Stripe minimum; keeps abandoned checkouts short-lived.

interface PostForSale {
  id: string;
  user_id: string;
  content: string | null;
  is_locked: boolean;
  media_path: string | null;
  price_cents: number | null;
}

/**
 * Creates a Stripe Checkout Session to unlock a drop.
 * Destination charge: the buyer pays the platform, 80% is transferred to the
 * creator's connected account and 20% stays as the application fee.
 * Access is granted only by the webhook, never by this route.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const { postId } = await readJson<{ postId: string }>(request);
    if (!isUuid(postId)) throw new HttpError(400, "Invalid drop.");

    const admin = getSupabaseAdmin();
    const stripe = getStripe();

    const { data: post, error: postError } = await admin
      .from("posts")
      .select("id, user_id, content, is_locked, media_path, price_cents")
      .eq("id", postId)
      .maybeSingle<PostForSale>();
    if (postError) throw new Error(`post lookup failed: ${postError.message}`);
    if (!post) throw new HttpError(404, "This drop no longer exists.");
    if (!post.is_locked || !post.media_path) throw new HttpError(400, "This drop is free to view.");
    if (post.user_id === user.id) throw new HttpError(400, "This is your own drop.");

    const { data: purchases, error: purchaseError } = await admin
      .from("purchases")
      .select("status, stripe_session_id, created_at")
      .eq("user_id", user.id)
      .eq("post_id", post.id)
      .in("status", ["completed", "pending"])
      .order("created_at", { ascending: false });
    if (purchaseError) throw new Error(`purchase lookup failed: ${purchaseError.message}`);
    if (purchases?.some((p) => p.status === "completed")) {
      throw new HttpError(409, "You already unlocked this drop.");
    }

    // Reuse a still-open checkout (e.g. a second tab) instead of charging twice.
    const pendingId = purchases?.find((p) => p.status === "pending")?.stripe_session_id;
    if (pendingId) {
      const existing = await stripe.checkout.sessions.retrieve(pendingId).catch(() => null);
      if (existing?.status === "open" && existing.url) return json({ url: existing.url });
    }

    let account = await getPayoutAccount(post.user_id);
    if (account && !account.transfers_active) {
      account = await syncPayoutAccount(post.user_id, account.stripe_account_id);
    }
    if (!account?.transfers_active) {
      throw new HttpError(409, "This creator hasn't finished setting up payouts yet.");
    }

    const amount = post.price_cents ?? LOCKED_PRICE_CENTS;
    if (!Number.isInteger(amount) || amount < MIN_CHARGE_CENTS) {
      throw new HttpError(400, "This drop has an invalid price.");
    }
    const platformFee = Math.round(amount * (1 - CREATOR_SHARE));

    const { data: creator } = await admin
      .from("profiles")
      .select("display_name, handle")
      .eq("id", post.user_id)
      .maybeSingle<{ display_name: string | null; handle: string }>();
    const creatorName = creator?.display_name?.trim() || (creator ? `@${creator.handle}` : "a creator");
    const description = post.content?.trim().slice(0, 200);

    const metadata = {
      post_id: post.id,
      buyer_id: user.id,
      creator_id: post.user_id,
      platform_fee_cents: String(platformFee),
    };

    const base = siteUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: amount,
            product_data: {
              name: `Unlock a drop by ${creatorName}`,
              ...(description ? { description } : {}),
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: { destination: account.stripe_account_id },
        metadata,
      },
      metadata,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      success_url: `${base}/?checkout=success`,
      cancel_url: `${base}/?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    // Pending row for bookkeeping; the webhook upserts the same row to "completed".
    const { error: insertError } = await admin.from("purchases").insert({
      user_id: user.id,
      post_id: post.id,
      stripe_session_id: session.id,
      status: "pending",
      amount_cents: amount,
      platform_fee_cents: platformFee,
      currency: CURRENCY,
    });
    if (insertError) console.error("[checkout] pending purchase insert failed", insertError.message);

    return json({ url: session.url });
  });
}
