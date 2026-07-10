import Stripe from "stripe";

/**
 * Lazily-constructed Stripe client (server-only). We omit an explicit apiVersion
 * so the account's default pinned version is used, avoiding TS literal-version
 * churn across SDK upgrades.
 */
let stripe: Stripe | null | undefined;

export function getStripe(): Stripe {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED");
  stripe = new Stripe(key);
  return stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
