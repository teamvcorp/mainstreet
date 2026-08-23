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
import { settleShippingAdjustment } from "@/lib/reconcile";
import { sendEmail } from "@/lib/email";
import { packAndShipHandoffEmail, type OrderEmailItem } from "@/lib/order-emails";
import { buildOrderConfirmation } from "@/emails/OrderConfirmation";

interface FinalizeCtx {
  piId: string;
  chargeId?: string;
  customerId?: string;
  paymentMethodId?: string;
}

/**
 * Finalize each paid sub-order: transfer the seller's subtotal (shipping stays on
 * the platform), decrement inventory, email buyer confirmation + SL Pack & Ship
 * handoff. Each order is isolated so one failure can't abort the batch (the
 * idempotency record is already written, so an aborted batch would never re-run).
 */
async function finalizeOrders(orderIds: string[], ctx: FinalizeCtx) {
  const transferGroup = orderIds[0] ? `grp_${orderIds[0]}` : undefined;
  for (const orderId of orderIds) {
    try {
      const data = await getOrderForFulfillment(orderId);
      if (!data || data.order.status !== "pending") continue;
      const { order, items } = data;

      let transferId: string | undefined;
      const acct = order.businessId?.stripeAccountId;
      if (acct && order.businessId?.stripeAccountActive && order.subtotalCents > 0) {
        try {
          const t = await getStripe().transfers.create({
            amount: order.subtotalCents,
            currency: "usd",
            destination: acct,
            ...(transferGroup ? { transfer_group: transferGroup } : {}),
            ...(ctx.chargeId ? { source_transaction: ctx.chargeId } : {}),
            metadata: { orderId },
          });
          transferId = t.id;
        } catch (err) {
          console.error(`Transfer for order ${orderId} failed:`, err);
        }
      }

      await markOrderPaid(orderId, ctx.piId, {
        transferId,
        customerId: ctx.customerId,
        paymentMethodId: ctx.paymentMethodId,
      });
      await decrementInventoryForOrder(orderId);

      const emailItems: OrderEmailItem[] = items.map((it) => {
        const snap = (it.productSnapshot ?? {}) as {
          name?: string;
          weightOz?: number;
          dimensions?: { lengthIn?: number; widthIn?: number; heightIn?: number };
        };
        return {
          name: snap.name ?? "Item",
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          weightOz: snap.weightOz,
          dimensions: snap.dimensions,
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
            shipFrom: order.businessId?.address
              ? { ...order.businessId.address, phone: order.businessId.phone }
              : undefined,
            shippingAddress: order.shippingAddress ?? {},
            items: emailItems,
            carrier: order.carrier,
            service: order.service,
          }),
        });
      }
    } catch (err) {
      console.error(`Webhook: finalizing order ${orderId} failed (needs reconciliation):`, err);
    }
  }
}

/**
 * Stripe webhook. Signature-verified + idempotent (WebhookEvent unique index).
 * Orders are paid via an embedded PaymentIntent (Payment Element) → finalized on
 * `payment_intent.succeeded`. Memberships/item-packs → `customer.subscription.*`.
 * The emailed shipping-adjustment pay-link is the only hosted Checkout left.
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

  // Idempotency: unique (provider,eventId) makes a retry a no-op.
  await connectToDatabase();
  try {
    await WebhookEvent.create({ provider: "stripe", eventId: event.id });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // --- Subscriptions (memberships + item packs) ---
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await applySubscription(event.data.object as Stripe.Subscription);
    return NextResponse.json({ received: true });
  }

  // --- Order payments (embedded Payment Element) ---
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderIds = (pi.metadata?.orderIds ?? "").split(",").filter(Boolean);
    if (orderIds.length === 0) {
      // Not an order PI (e.g. a subscription invoice PI) — subscriptions are
      // handled via customer.subscription.* above.
      return NextResponse.json({ received: true });
    }
    await finalizeOrders(orderIds, {
      piId: pi.id,
      chargeId: typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id,
      customerId: typeof pi.customer === "string" ? pi.customer : pi.customer?.id,
      paymentMethodId:
        typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id,
    });
    return NextResponse.json({ received: true });
  }

  // --- Hosted Checkout (only the shipping-adjustment pay-link remains) ---
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.type === "shipping_adjustment" && session.metadata?.orderId) {
      await settleShippingAdjustment(
        session.metadata.orderId,
        parseInt(session.metadata.finalShippingCents ?? "0", 10),
      );
    }
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
