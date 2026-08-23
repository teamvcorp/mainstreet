"use client";

import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";
import { getStripePromise } from "@/lib/stripe-client";
import { Button } from "@/components/ui/button";

/**
 * Embedded Stripe Payment Element. Cards + wallets (Apple/Google Pay) + Link
 * confirm in place — no redirect off-site (3-D Secure shows an in-page modal).
 * `onSuccess` fires for in-page confirmations; redirect-based methods land on
 * `returnPath` and are handled there.
 */
export function PaymentForm({
  clientSecret,
  returnPath,
  submitLabel = "Pay",
  onSuccess,
}: {
  clientSecret: string;
  returnPath: string;
  submitLabel?: string;
  onSuccess?: () => void;
}) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: { colorPrimary: "#12233B", borderRadius: "8px", fontFamily: "system-ui, sans-serif" },
    },
  };
  return (
    <Elements stripe={getStripePromise()} options={options}>
      <InnerForm returnPath={returnPath} submitLabel={submitLabel} onSuccess={onSuccess} />
    </Elements>
  );
}

function InnerForm({
  returnPath,
  submitLabel,
  onSuccess,
}: {
  returnPath: string;
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${returnPath}` },
      redirect: "if_required",
    });

    if (err) {
      setError(err.message ?? "Payment could not be completed.");
      setBusy(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      onSuccess?.();
      return; // leave busy=true; parent navigates
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
