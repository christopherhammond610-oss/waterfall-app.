import "server-only";
import type { PayoutStatus } from "@/lib/types";
import { getStripe } from "./stripe";
import { getSupabaseAdmin } from "./supabase-admin";

export interface PayoutAccountRow {
  user_id: string;
  stripe_account_id: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
  transfers_active: boolean;
}

export const NOT_CONNECTED: PayoutStatus = {
  connected: false,
  detailsSubmitted: false,
  payoutsEnabled: false,
  ready: false,
};

export function toStatus(row: PayoutAccountRow | null): PayoutStatus {
  if (!row) return NOT_CONNECTED;
  return {
    connected: true,
    detailsSubmitted: row.details_submitted,
    payoutsEnabled: row.payouts_enabled,
    ready: row.transfers_active,
  };
}

export async function getPayoutAccount(userId: string): Promise<PayoutAccountRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("stripe_accounts")
    .select("user_id, stripe_account_id, details_submitted, payouts_enabled, transfers_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`stripe_accounts lookup failed: ${error.message}`);
  return data as PayoutAccountRow | null;
}

/** Pulls the live account state from Stripe (Accounts v2) and stores it, plus the public profile flag. */
export async function syncPayoutAccount(userId: string, accountId: string): Promise<PayoutAccountRow> {
  const account = await getStripe().v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient", "requirements"],
  });
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;
  const transfersActive = balance?.stripe_transfers?.status === "active";
  const due = account.requirements?.summary?.minimum_deadline?.status;

  const row: PayoutAccountRow = {
    user_id: userId,
    stripe_account_id: account.id,
    // Nothing currently required from the creator = onboarding details are in.
    details_submitted: transfersActive || (due !== "currently_due" && due !== "past_due"),
    payouts_enabled: balance?.payouts?.status === "active",
    transfers_active: transfersActive,
  };

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("stripe_accounts").update(row).eq("user_id", userId);
  if (error) throw new Error(`stripe_accounts update failed: ${error.message}`);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ accepts_payments: row.transfers_active })
    .eq("id", userId);
  if (profileError) throw new Error(`profiles update failed: ${profileError.message}`);

  return row;
}
