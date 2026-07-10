import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { connectToDatabase } from "@/lib/db";
import { WebhookEvent } from "@/lib/models/WebhookEvent";
import {
  getOrderForFulfillment,
  markOrderPaid,
  decrementInventoryForOrder,
} from "@/lib/orders";
import { applySubscription } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { packAndShipHandoffEmail, type OrderEmailItem } from "@/lib/order-emails";
import { buildOrderConfirmation } from "@/emails/OrderConfirmation";

/**
 * Stripe webhook. Signature-verified + idempotent (WebhookEvent unique index).
 * On checkout.session.completed:
 *  - mark each sub-order paid
 *  - transfer each business's SUBTOTAL to its connected account (shipping stays
 *    on the platform), tied to the charge via source_transaction
 *  - email the buyer a confirmation, and email SL Pack & Ship for ship orders
 */
export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return new NextResponse("Webhook not configured", { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // Idempotency: unique (provider,eventId) makes a retry no-op.
  await connectToDatabase();
  try {
    await WebhookEvent.create({ provider: "stripe", eventId: event.id });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // --- Subscriptions (memberships + item packs) ---
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await applySubscription(event.data.object as Stripe.Subscription);
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Subscription checkouts (membership / item packs) — apply and return.
    if (session.mode === "subscription") {
      const subId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subId) {
        const sub = await getStripe().subscriptions.retrieve(subId);
        await applySubscription(sub);
      }
      return NextResponse.json({ received: true });
    }

    const orderIds = (session.metadata?.orderIds ?? "").split(",").filter(Boolean);
    const piId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    let chargeId: string | undefined;
    if (piId) {
      const pi = await getStripe().paymentIntents.retrieve(piId);
      chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
    }
    const transferGroup = orderIds[0] ? `grp_${orderIds[0]}` : undefined;

    for (const orderId of orderIds) {
      const data = await getOrderForFulfillment(orderId);
      if (!data || data.order.status !== "pending") continue;
      const { order, items } = data;

      // Pay the seller their product subtotal (not shipping).
      let transferId: string | undefined;
      const acct = order.businessId?.stripeAccountId;
      if (acct && order.businessId?.stripeAccountActive && order.subtotalCents > 0) {
        try {
          const t = await getStripe().transfers.create({
            amount: order.subtotalCents,
            currency: "usd",
            destination: acct,
            ...(transferGroup ? { transfer_group: transferGroup } : {}),
            ...(chargeId ? { source_transaction: chargeId } : {}),
            metadata: { orderId },
          });
          transferId = t.id;
        } catch (err) {
          console.error(`Transfer for order ${orderId} failed:`, err);
        }
      }

      await markOrderPaid(orderId, piId ?? "", transferId);
      await decrementInventoryForOrder(orderId);

      const emailItems: OrderEmailItem[] = items.map((it) => {
        const snap = (it.productSnapshot ?? {}) as { name?: string; weightOz?: number };
        return {
          name: snap.name ?? "Item",
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          weightOz: snap.weightOz,
        };
      });
      const businessName = order.businessId?.name ?? "the shop";

      if (order.buyerId?.email) {
        await sendEmail({
          to: order.buyerId.email,
          ...buildOrderConfirmation({
            orderId,
            businessName,
            items: emailItems,
            subtotalCents: order.subtotalCents,
            shippingCents: order.shippingCents,
            totalCents: order.totalCents,
            fulfillmentType: order.fulfillmentType,
          }),
        });
      }

      if (order.fulfillmentType === "ship" && process.env.SHIPIT_EMAIL) {
        await sendEmail({
          to: process.env.SHIPIT_EMAIL,
          ...packAndShipHandoffEmail({
            orderId,
            businessName,
            shippingAddress: order.shippingAddress ?? {},
            items: emailItems,
            carrier: order.carrier,
            service: order.service,
          }),
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
