import "server-only";
import Stripe from "stripe";

let stripe: Stripe | null = null;

/** Stripe client (secret key, server only). Uses the API version pinned by the SDK. */
export function getStripe(): Stripe {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  stripe = new Stripe(key, { appInfo: { name: "Waterfall" } });
  return stripe;
}
