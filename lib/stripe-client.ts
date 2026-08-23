"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Memoized Stripe.js loader for the browser (Payment Element). Uses the public
 * publishable key; returns null if it's unset so callers can degrade gracefully.
 */
let promise: Promise<Stripe | null> | undefined;

export function getStripePromise(): Promise<Stripe | null> {
  if (!promise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    promise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return promise;
}
