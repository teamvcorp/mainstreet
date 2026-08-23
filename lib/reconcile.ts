import { connectToDatabase } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { getStripe } from "@/lib/stripe";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type ReconcileResult =
  | { status: "noop"; delta: number }
  | { status: "charged"; delta: number }
  | { status: "refunded"; delta: number }
  | { status: "buyer_action"; delta: number; url: string; buyerEmail?: string; orderId: string };

/**
 * Reconcile an order's final shipping against what was charged at checkout (the
 * estimate). Admin supplies the FINAL buyer shipping amount:
 *  - equal   → mark reconciled.
 *  - less    → refund the difference on the original PaymentIntent.
 *  - more    → charge the difference OFF-SESSION to the saved card. If that fails
 *              (declined / needs auth), create a hosted Checkout session for the
 *              buyer to pay and flag the order (caller emails the link).
 * Shipping revenue stays on the platform (no seller transfer on adjustments).
 */
export async function reconcileShipping(
  orderId: string,
  finalShippingCents: number,
): Promise<ReconcileResult> {
  await connectToDatabase();
  const order = await Order.findById(orderId)
    .select("+carrierCostCents +platformFeeCents")
    .populate("buyerId", "email");
  if (!order) throw new Error("NOT_FOUND");

  const delta = finalShippingCents - order.shippingCents;
  const stripe = getStripe();

  const applyLocal = () => {
    order.shippingCents = finalShippingCents;
    order.totalCents = order.totalCents + delta;
    if (typeof order.carrierCostCents === "number") {
      order.platformFeeCents = finalShippingCents - order.carrierCostCents;
    }
    order.shippingReconciled = true;
    order.shippingAdjustmentSessionId = undefined;
  };

  if (delta === 0) {
    order.shippingReconciled = true;
    await order.save();
    return { status: "noop", delta };
  }

  if (delta < 0) {
    if (!order.stripePaymentIntentId) throw new Error("NO_PAYMENT");
    await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount: Math.abs(delta),
      metadata: { type: "shipping_adjustment", orderId },
    });
    applyLocal();
    await order.save();
    return { status: "refunded", delta };
  }

  // delta > 0 — try an off-session charge on the saved card first.
  if (order.stripeCustomerId && order.stripePaymentMethodId) {
    try {
      await stripe.paymentIntents.create({
        amount: delta,
        currency: "usd",
        customer: order.stripeCustomerId,
        payment_method: order.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Shipping adjustment — order ${orderId}`,
        metadata: { type: "shipping_adjustment", orderId, finalShippingCents: String(finalShippingCents) },
      });
      applyLocal();
      await order.save();
      return { status: "charged", delta };
    } catch (err) {
      console.error(`Off-session shipping charge failed for order ${orderId}:`, err);
      // fall through to buyer-pay session
    }
  }

  // Buyer must pay: hosted Checkout session for the difference.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: order.stripeCustomerId ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: delta,
          product_data: { name: `Shipping adjustment — order ${orderId}` },
        },
      },
    ],
    metadata: { type: "shipping_adjustment", orderId, finalShippingCents: String(finalShippingCents) },
    payment_intent_data: { metadata: { type: "shipping_adjustment", orderId } },
    success_url: `${BASE}/orders/${orderId}?shipping=paid`,
    cancel_url: `${BASE}/orders/${orderId}`,
  });
  order.shippingAdjustmentSessionId = session.id;
  order.shippingReconciled = false;
  await order.save();

  const buyer = order.buyerId as unknown as { email?: string } | null;
  return { status: "buyer_action", delta, url: session.url!, buyerEmail: buyer?.email, orderId };
}

/** Called by the webhook when the buyer completes the adjustment Checkout. */
export async function settleShippingAdjustment(orderId: string, finalShippingCents: number) {
  await connectToDatabase();
  const order = await Order.findById(orderId).select("+carrierCostCents +platformFeeCents");
  if (!order || order.shippingReconciled) return;
  const delta = finalShippingCents - order.shippingCents;
  order.shippingCents = finalShippingCents;
  order.totalCents = order.totalCents + delta;
  if (typeof order.carrierCostCents === "number") {
    order.platformFeeCents = finalShippingCents - order.carrierCostCents;
  }
  order.shippingReconciled = true;
  order.shippingAdjustmentSessionId = undefined;
  await order.save();
}
