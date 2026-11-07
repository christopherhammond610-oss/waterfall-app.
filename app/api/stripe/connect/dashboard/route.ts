import { handle, HttpError, json, requireUser } from "@/lib/server/http";
import { getPayoutAccount } from "@/lib/server/payouts";
import { getStripe } from "@/lib/server/stripe";

/** One-time login link to the creator's Stripe Express dashboard (balance, payouts). */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const account = await getPayoutAccount(user.id);
    if (!account) throw new HttpError(404, "Connect your payouts first.");
    if (!account.details_submitted) throw new HttpError(409, "Finish your Stripe setup first.");
    const link = await getStripe().accounts.createLoginLink(account.stripe_account_id);
    return json({ url: link.url });
  });
}
