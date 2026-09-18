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
 * Reconcile an order's final shipping against what was charged at checkout.
 *
 * This is now an EXCEPTION path, not a per-order step: Storm Lake locks the retail
 * price at quote time, so the only way a delta arises is a quote expiring between
 * payment and shipment creation (see lib/fulfillment.ts handleExpiredQuote), or an
 * admin correcting a figure by hand.
 *
 * Concurrency: every Stripe call carries a DETERMINISTIC idempotency key derived from
 * the order plus the exact from -> to transition, and the local write is a
 * compare-and-swap on the amount we read. Two simultaneous submits therefore collapse
 * into one refund/charge instead of both acting on the same pre-write value, while a
 * genuine later correction (a different transition) still goes through.
 *
 * Admin supplies the FINAL buyer shipping amount:
 *  - equal   → mark reconciled.
 *  - less    → refund the difference on the original PaymentIntent.
 *  - more    → charge the difference OFF-SESSION to the saved card. If that fails
 *              (declined / needs auth), create a hosted Checkout session for the
 *              buyer to pay and flag the order (caller emails the link).
 * No seller transfer happens on an adjustment: shipping is a pass-through to Storm
 * Lake, so the platform neither keeps nor owes anything on the delta.
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

  const fromCents = order.shippingCents;
  const delta = finalShippingCents - fromCents;
  const stripe = getStripe();
  // Same order + same transition => same key, so concurrent submits collapse.
  const idempotencyKey = `shipadj_${orderId}_${fromCents}_${finalShippingCents}`;

  /**
   * Apply the money change locally, conditioned on the amount not having moved since
   * we read it. Returns false when another request got there first.
   */
  const applyLocal = async (): Promise<boolean> => {
    const res = await Order.updateOne(
      { _id: orderId, shippingCents: fromCents },
      {
        $set: {
          shippingCents: finalShippingCents,
          totalCents: order.totalCents + delta,
          // Shipping is a pass-through now: the partner reports retail only, so our
          // cost IS the buyer price and the platform keeps nothing. (The old
          // `final - carrierCost` could even go negative on a refund.)
          carrierCostCents: finalShippingCents,
          platformFeeCents: 0,
          shippingReconciled: true,
        },
        $unset: { shippingAdjustmentSessionId: "" },
      },
    );
    return res.modifiedCount === 1;
  };

  if (delta === 0) {
    await Order.updateOne({ _id: orderId }, { $set: { shippingReconciled: true } });
    return { status: "noop", delta };
  }

  if (delta < 0) {
    if (!order.stripePaymentIntentId) throw new Error("NO_PAYMENT");
    await stripe.refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        amount: Math.abs(delta),
        metadata: { type: "shipping_adjustment", orderId },
      },
      { idempotencyKey: `${idempotencyKey}_refund` },
    );
    await applyLocal();
    return { status: "refunded", delta };
  }

  // delta > 0 — try an off-session charge on the saved card first.
  if (order.stripeCustomerId && order.stripePaymentMethodId) {
    try {
      await stripe.paymentIntents.create(
        {
          amount: delta,
          currency: "usd",
          customer: order.stripeCustomerId,
          payment_method: order.stripePaymentMethodId,
          off_session: true,
          confirm: true,
          description: `Shipping adjustment — order ${orderId}`,
          metadata: { type: "shipping_adjustment", orderId, finalShippingCents: String(finalShippingCents) },
        },
        { idempotencyKey: `${idempotencyKey}_charge` },
      );
      await applyLocal();
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
  // Pass-through: our cost is the buyer price, platform keeps nothing.
  order.carrierCostCents = finalShippingCents;
  order.platformFeeCents = 0;
  order.shippingReconciled = true;
  order.shippingAdjustmentSessionId = undefined;
  await order.save();
}
