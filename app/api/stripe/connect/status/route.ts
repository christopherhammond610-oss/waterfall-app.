import { handle, json, requireUser } from "@/lib/server/http";
import { getPayoutAccount, NOT_CONNECTED, syncPayoutAccount, toStatus } from "@/lib/server/payouts";

/** Refreshes the signed-in creator's payout status from Stripe and returns it. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const account = await getPayoutAccount(user.id);
    if (!account) return json(NOT_CONNECTED);
    const synced = await syncPayoutAccount(user.id, account.stripe_account_id);
    return json(toStatus(synced));
  });
}
