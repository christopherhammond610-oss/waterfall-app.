import "server-only";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "./supabase-admin";

type FinalStatus = "expired" | "failed";

function paymentIntentId(value: string | Stripe.PaymentIntent | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Marks a paid Checkout Session as a completed purchase. Idempotent: Stripe
 * may deliver the same event more than once, and the upsert keys on the session.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  // Delayed payment methods report "unpaid" first and complete via async_payment_succeeded.
  if (session.payment_status !== "paid") return;

  const postId = session.metadata?.post_id;
  const buyerId = session.metadata?.buyer_id;
  if (!postId || !buyerId) return; // Not a Waterfall unlock.

  const fee = Number(session.metadata?.platform_fee_cents);
  const { error } = await getSupabaseAdmin()
    .from("purchases")
    .upsert(
      {
        stripe_session_id: session.id,
        user_id: buyerId,
        post_id: postId,
        status: "completed",
        amount_cents: session.amount_total,
        platform_fee_cents: Number.isFinite(fee) ? fee : null,
        currency: session.currency ?? "usd",
        stripe_payment_intent_id: paymentIntentId(session.payment_intent),
      },
      { onConflict: "stripe_session_id" },
    );
  if (error) throw new Error(`purchase upsert failed: ${error.message}`);
}

/** Closes a still-pending purchase whose session expired or whose payment failed. */
export async function closePendingSession(sessionId: string, status: FinalStatus): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("purchases")
    .update({ status })
    .eq("stripe_session_id", sessionId)
    .eq("status", "pending");
  if (error) throw new Error(`purchase ${status} update failed: ${error.message}`);
}

/** A fully refunded charge revokes access (storage only serves "completed" purchases). */
export async function revokeRefundedCharge(charge: Stripe.Charge): Promise<void> {
  if (!charge.refunded) return; // Partial refunds keep access.
  const intent = paymentIntentId(charge.payment_intent);
  if (!intent) return;
  const { error } = await getSupabaseAdmin()
    .from("purchases")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", intent);
  if (error) throw new Error(`purchase refund update failed: ${error.message}`);
}
