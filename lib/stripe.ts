import Stripe from "stripe";

/**
 * Lazily-constructed Stripe client (server-only). We pin apiVersion to the SDK's
 * own bundled version (`Stripe.API_VERSION`) so runtime responses match the
 * TypeScript types the codebase compiles against — critical for fields that moved
 * across versions (e.g. `invoice.confirmation_secret`). Using the SDK constant
 * (not a hardcoded literal) means the pin tracks the installed SDK automatically.
 */
let stripe: Stripe | null | undefined;

export function getStripe(): Stripe {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED");
  stripe = new Stripe(key, { apiVersion: Stripe.API_VERSION });
  return stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
