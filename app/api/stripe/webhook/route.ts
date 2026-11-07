import type Stripe from "stripe";
import { json } from "@/lib/server/http";
import { closePendingSession, fulfillCheckoutSession, revokeRefundedCharge } from "@/lib/server/purchases";
import { getStripe } from "@/lib/server/stripe";

/**
 * Stripe webhook. The signature is verified against the raw body, then the
 * purchase is recorded. This is the only place paid access is granted
 * (Stripe recommends fulfilling from webhooks, not the success redirect).
 *
 * Events to enable on the endpoint:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.async_payment_failed, checkout.session.expired, charge.refunded
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return json({ error: "Webhook is not configured." }, 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing Stripe signature." }, 400);

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return json({ error: "Invalid Stripe signature." }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfillCheckoutSession(event.data.object);
        break;
      case "checkout.session.async_payment_failed":
        await closePendingSession(event.data.object.id, "failed");
        break;
      case "checkout.session.expired":
        await closePendingSession(event.data.object.id, "expired");
        break;
      case "charge.refunded":
        await revokeRefundedCharge(event.data.object);
        break;
      default:
        // Other events are acknowledged and ignored.
        break;
    }
  } catch (error) {
    // A 500 makes Stripe retry the event later.
    console.error(`[stripe webhook] ${event.type} failed`, error);
    return json({ error: "Webhook handler failed." }, 500);
  }

  return json({ received: true });
}
