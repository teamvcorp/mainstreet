import { connectToDatabase } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { OrderItem, type IOrderItem } from "@/lib/models/OrderItem";
import { Shipment } from "@/lib/models/Shipment";
import { resolveShippingChoice, resolveLabelEmail, type CartLine } from "@/lib/shipping";
import { createShipment, listShipments, SlpsError } from "@/lib/slpacknship";
import { reconcileShipping } from "@/lib/reconcile";
import type { ShipMode } from "@/lib/models/Business";

/**
 * Turning a PAID order into a real shipment via Storm Lake Pack & Ship.
 *
 * Ordering matters: the partner refuses to produce a label without a succeeded
 * PaymentIntent that covers the quote (contract §5), so this runs from the Stripe
 * webhook AFTER the order is marked paid — never at checkout.
 *
 * The two modes end in different places:
 *   self_ship   → label emailed to the business, tracking returned → order `shipped`
 *   pickup_pack → Storm Lake collects and packs, no tracking yet   → order `processing`
 */

export type ShipmentOutcome =
  | { status: "created"; mode: ShipMode; trackingNumber?: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/** Rebuild the cart lines for an order so shipping can be re-quoted from the DB. */
function linesFromItems(businessId: string, items: IOrderItem[]): CartLine[] {
  return items.map((it) => ({
    productId: String(it.productId),
    businessId,
    variantId: it.variantId ? String(it.variantId) : undefined,
    quantity: it.quantity,
  }));
}

/**
 * Create the shipment for one paid order.
 *
 * Never throws — a shipment problem must not fail the webhook, or Stripe would retry
 * the whole delivery and re-run the transfers alongside it. Failures are recorded on
 * the order as `shipmentFailedReason` for an admin to retry.
 */
export async function createShipmentForOrder(
  orderId: string,
  paymentIntentId: string,
): Promise<ShipmentOutcome> {
  try {
    await connectToDatabase();
    const order = await Order.findById(orderId).populate("businessId", "name shipMode");
    if (!order) return { status: "skipped", reason: "order not found" };

    // Pickup orders never involve a carrier.
    if (order.fulfillmentType !== "ship") {
      return { status: "skipped", reason: "pickup order" };
    }
    // Already shipped. The webhook is idempotent via the WebhookEvent unique index,
    // and partner quotes are single-use, so this is the third belt on the braces.
    if (order.shipmentId) {
      return { status: "skipped", reason: "shipment already created" };
    }
    if (!order.shipQuoteId) {
      return { status: "failed", reason: "no shipping quote stored on the order" };
    }

    const addr = order.shippingAddress;
    if (!addr?.zip || !addr?.street) {
      return { status: "failed", reason: "order has no usable shipping address" };
    }

    const businessId = String(order.businessId?._id ?? order.businessId);
    const mode: ShipMode = order.shipMode ?? "pickup_pack";

    // self_ship has nowhere to send the label without an address.
    let businessEmail: string | undefined;
    if (mode === "self_ship") {
      businessEmail = await resolveLabelEmail(businessId);
      if (!businessEmail) {
        return { status: "failed", reason: "self_ship order has no business email for the label" };
      }
    }

    const buyer = await Order.findById(orderId).populate("buyerId", "email").lean<{
      buyerId?: { email?: string };
    }>();

    const recipient = {
      name: addr.name,
      phone: addr.phone ?? "",
      email: buyer?.buyerId?.email ?? "",
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
    };

    let quoteId = order.shipQuoteId;
    let result;
    try {
      result = await createShipment({
        quoteId,
        paymentIntentId,
        mode,
        businessEmail,
        orderRef: orderId,
        recipient,
      });
    } catch (err) {
      // A single-use quote that expired (~30 min TTL) or was already consumed.
      if (err instanceof SlpsError && err.code === "QUOTE_EXPIRED") {
        const requoted = await handleExpiredQuote(orderId, businessId, mode, order.shippingCents);
        if (!requoted.ok) return { status: "failed", reason: requoted.reason };
        quoteId = requoted.quoteId;
        result = await createShipment({
          quoteId,
          paymentIntentId,
          mode,
          businessEmail,
          orderRef: orderId,
          recipient,
        });
      } else {
        throw err;
      }
    }

    // self_ship comes back shipped with tracking; pickup_pack is "awaiting_pack" and
    // has no tracking until Storm Lake actually ships it (backfilled by the cron).
    const shipped = mode === "self_ship" && !!result.trackingNumber;

    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          shipmentId: result.id,
          shipQuoteId: quoteId,
          shipMode: mode,
          status: shipped ? "shipped" : "processing",
          ...(result.trackingNumber ? { trackingNumber: result.trackingNumber } : {}),
          ...(result.carrier ? { carrier: result.carrier } : {}),
          ...(result.labelEmailedTo ? { labelEmailedTo: result.labelEmailedTo } : {}),
          ...(shipped ? { shippedAt: new Date() } : {}),
        },
        $unset: { shipmentFailedReason: "" },
      },
    );

    await Shipment.create({
      orderId,
      partnerShipmentId: result.id,
      quoteId,
      mode,
      carrier: result.carrier,
      service: result.serviceName ?? order.service,
      trackingNumber: result.trackingNumber,
      labelEmailedTo: result.labelEmailedTo,
      consumerRateCents: order.shippingCents,
      status: result.status,
    });

    return { status: "created", mode, trackingNumber: result.trackingNumber };
  } catch (err) {
    const reason =
      err instanceof SlpsError ? `${err.code}: ${err.message}` : `unexpected: ${String(err)}`;
    console.error(`createShipmentForOrder(${orderId}) failed —`, err);
    // Record it so /admin/orders can surface a retry rather than losing the order.
    await Order.updateOne({ _id: orderId }, { $set: { shipmentFailedReason: reason } }).catch(
      () => {},
    );
    return { status: "failed", reason };
  }
}

/**
 * A quote expired between payment and shipment creation, so we need a fresh one.
 *
 * We can only proceed if the new price is NOT above what the buyer already paid: the
 * partner verifies the PaymentIntent covers the quote, and a top-up would land on a
 * separate PaymentIntent that `/shipments` has no way to be told about. Cheaper is
 * fine — we ship and refund the difference. Dearer is flagged for a human.
 *
 * See open question 8 in docs/slpacknship.md.
 */
async function handleExpiredQuote(
  orderId: string,
  businessId: string,
  mode: ShipMode,
  paidShippingCents: number,
): Promise<{ ok: true; quoteId: string } | { ok: false; reason: string }> {
  const order = await Order.findById(orderId);
  if (!order?.shippingAddress?.zip) return { ok: false, reason: "no address to re-quote" };

  const items = await OrderItem.find({ orderId }).lean<IOrderItem[]>();
  let resolved;
  try {
    resolved = await resolveShippingChoice(
      businessId,
      linesFromItems(businessId, items),
      {
        zip: order.shippingAddress.zip,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
      },
      { mode: "ship", carrier: order.carrier, service: order.service },
    );
  } catch (err) {
    return { ok: false, reason: `re-quote failed after quote expiry: ${String(err)}` };
  }
  if (!resolved.quoteId) return { ok: false, reason: "re-quote returned no quote id" };

  if (resolved.consumerCents > paidShippingCents) {
    return {
      ok: false,
      reason:
        `quote expired and re-quote is higher (${resolved.consumerCents} > ${paidShippingCents} cents); ` +
        `needs a top-up charge before a label can be bought`,
    };
  }

  // Cheaper (or equal): refund the difference, then ship on the new quote.
  if (resolved.consumerCents < paidShippingCents) {
    await reconcileShipping(orderId, resolved.consumerCents).catch((err) =>
      console.error(`Refund after quote expiry failed for order ${orderId}:`, err),
    );
  }
  return { ok: true, quoteId: resolved.quoteId };
}

/**
 * Backfill tracking for `pickup_pack` orders.
 *
 * That mode returns no tracking at creation and the contract exposes no webhook, so
 * polling our own shipment history (§6) is the only way to learn the number. Rows are
 * matched on `orderRef`, which we set to the order id.
 */
export async function backfillShipmentTracking(limit = 100): Promise<{
  checked: number;
  updated: number;
}> {
  await connectToDatabase();

  // Only orders that are waiting on a tracking number.
  const pending = await Order.find({
    fulfillmentType: "ship",
    status: "processing",
    shipmentId: { $exists: true, $ne: null },
    $or: [{ trackingNumber: { $exists: false } }, { trackingNumber: null }, { trackingNumber: "" }],
  })
    .select("_id shipmentId")
    .limit(limit)
    .lean<{ _id: { toString(): string }; shipmentId?: string }[]>();

  if (pending.length === 0) return { checked: 0, updated: 0 };

  const rows = await listShipments(Math.min(Math.max(pending.length * 2, 50), 200));
  const byRef = new Map(rows.filter((r) => r.orderRef).map((r) => [r.orderRef as string, r]));
  const byId = new Map(rows.map((r) => [r.id, r]));

  let updated = 0;
  for (const o of pending) {
    const orderId = o._id.toString();
    const row = byRef.get(orderId) ?? (o.shipmentId ? byId.get(o.shipmentId) : undefined);
    if (!row?.trackingNumber) continue;

    await Order.updateOne(
      { _id: orderId, $or: [{ trackingNumber: { $exists: false } }, { trackingNumber: "" }] },
      {
        $set: {
          trackingNumber: row.trackingNumber,
          ...(row.carrier ? { carrier: row.carrier } : {}),
          status: "shipped",
          shippedAt: new Date(),
        },
      },
    );
    await Shipment.updateOne(
      { orderId },
      {
        $set: {
          trackingNumber: row.trackingNumber,
          ...(row.carrier ? { carrier: row.carrier } : {}),
          status: row.status,
        },
      },
    );
    updated++;
  }

  return { checked: pending.length, updated };
}
