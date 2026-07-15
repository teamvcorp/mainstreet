import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { Product } from "@/lib/models/Product";
import { Order, type IOrder } from "@/lib/models/Order";
import { OrderItem, type IOrderItem } from "@/lib/models/OrderItem";
import { resolveShippingChoice, type CartLine } from "@/lib/shipping";
import type { ShipAddressInput } from "@/schemas/checkout";

export interface CheckoutSelection {
  mode: "ship" | "pickup";
  carrier?: string;
  service?: string;
}

export interface StripeLineItem {
  name: string;
  amountCents: number;
  quantity: number;
}

export interface PreparedCheckout {
  orderIds: string[];
  lineItems: StripeLineItem[];
  grandTotalCents: number;
}

/**
 * Create one PENDING order per business from the cart. Prices come from the DB
 * (never the client), inventory is checked, and the confidential carrier cost +
 * margin are stored but never surfaced. Returns Stripe line items for a hosted
 * Checkout Session.
 */
export async function createPendingOrdersForCheckout(input: {
  buyerId: string;
  items: CartLine[];
  toAddress: ShipAddressInput;
  selections: Record<string, CheckoutSelection>;
}): Promise<PreparedCheckout> {
  await connectToDatabase();
  const addr = {
    name: input.toAddress.name,
    street1: input.toAddress.street,
    city: input.toAddress.city,
    state: input.toAddress.state,
    zip: input.toAddress.zip,
  };

  const byBiz = new Map<string, CartLine[]>();
  for (const l of input.items) {
    if (!byBiz.has(l.businessId)) byBiz.set(l.businessId, []);
    byBiz.get(l.businessId)!.push(l);
  }

  const orderIds: string[] = [];
  const lineItems: StripeLineItem[] = [];
  let grand = 0;

  for (const [businessId, lines] of byBiz) {
    const biz = await Business.findById(businessId).select("name isActive").lean<{
      name: string;
      isActive: boolean;
    }>();
    if (!biz || !biz.isActive) throw new Error("NOT_FOUND");

    const products = await Product.find({
      _id: { $in: lines.map((l) => l.productId) },
      businessId,
      isActive: true,
    }).lean<
      {
        _id: { toString(): string };
        name: string;
        slug: string;
        priceCents: number;
        images: string[];
        inventoryQty: number;
        trackInventory: boolean;
        weightOz?: number;
        dimensions?: { lengthIn?: number; widthIn?: number; heightIn?: number };
      }[]
    >();
    const pMap = new Map(products.map((p) => [p._id.toString(), p]));

    let subtotal = 0;
    const itemDocs: Partial<IOrderItem>[] = [];
    for (const line of lines) {
      const p = pMap.get(line.productId);
      if (!p) throw new Error("NOT_FOUND");
      if (p.trackInventory && p.inventoryQty < line.quantity) throw new Error("OUT_OF_STOCK");
      subtotal += p.priceCents * line.quantity;
      lineItems.push({ name: p.name, amountCents: p.priceCents, quantity: line.quantity });
      itemDocs.push({
        productId: p._id as unknown as IOrderItem["productId"],
        quantity: line.quantity,
        unitPriceCents: p.priceCents,
        productSnapshot: {
          name: p.name,
          slug: p.slug,
          images: p.images,
          weightOz: p.weightOz,
          dimensions: p.dimensions,
        },
      });
    }

    const choice = input.selections[businessId] ?? { mode: "pickup" as const };
    const ship = await resolveShippingChoice(businessId, lines, addr, choice);
    const shippingCents = ship.consumerCents;
    const total = subtotal + shippingCents;
    grand += total;

    const order = await Order.create({
      buyerId: input.buyerId,
      businessId,
      status: "pending",
      fulfillmentType: choice.mode === "ship" ? "ship" : "pickup",
      subtotalCents: subtotal,
      shippingCents,
      carrierCostCents: ship.carrierCents,
      platformFeeCents: Math.max(0, shippingCents - ship.carrierCents),
      taxCents: 0,
      totalCents: total,
      shippingAddress: {
        name: input.toAddress.name,
        street: input.toAddress.street,
        city: input.toAddress.city,
        state: input.toAddress.state,
        zip: input.toAddress.zip,
        phone: input.toAddress.phone,
      },
      carrier: ship.carrier,
      service: ship.service,
    });

    await OrderItem.insertMany(itemDocs.map((d) => ({ ...d, orderId: order._id })));
    if (shippingCents > 0) {
      lineItems.push({ name: `Shipping — ${biz.name}`, amountCents: shippingCents, quantity: 1 });
    }
    orderIds.push(order._id.toString());
  }

  return { orderIds, lineItems, grandTotalCents: grand };
}

/** Order + business + items for webhook finalization (includes confidential fields). */
export async function getOrderForFulfillment(orderId: string) {
  await connectToDatabase();
  const order = await Order.findById(orderId)
    .select("+carrierCostCents +platformFeeCents")
    .populate("businessId", "name phone stripeAccountId stripeAccountActive address")
    .populate("buyerId", "email name")
    .lean<
      IOrder & {
        _id: { toString(): string };
        businessId?: {
          name: string;
          phone?: string;
          stripeAccountId?: string;
          stripeAccountActive?: boolean;
          address?: { street?: string; city?: string; state?: string; zip?: string };
        };
        buyerId?: { email?: string; name?: string };
      }
    >();
  if (!order) return null;
  const items = await OrderItem.find({ orderId }).lean<IOrderItem[]>();
  return { order, items };
}

export async function markOrderPaid(orderId: string, piId: string, transferId?: string) {
  await connectToDatabase();
  await Order.updateOne(
    { _id: orderId },
    { $set: { status: "paid", stripePaymentIntentId: piId, ...(transferId ? { stripeTransferId: transferId } : {}) } },
  );
}

/** Decrement inventory for a paid order's items (best-effort). */
export async function decrementInventoryForOrder(orderId: string) {
  await connectToDatabase();
  const items = await OrderItem.find({ orderId }).select("productId quantity").lean<
    { productId: { toString(): string }; quantity: number }[]
  >();
  for (const it of items) {
    await Product.updateOne(
      { _id: it.productId.toString(), trackInventory: true },
      { $inc: { inventoryQty: -it.quantity } },
    );
  }
}

// --- Buyer-facing (safe DTOs, no confidential fields) --------------------
export async function listBuyerOrders(buyerId: string) {
  await connectToDatabase();
  const orders = await Order.find({ buyerId })
    .sort({ createdAt: -1 })
    .populate("businessId", "name slug")
    .lean<(IOrder & { _id: { toString(): string }; businessId?: { name: string; slug: string } })[]>();
  return orders.map((o) => ({
    id: o._id.toString(),
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    totalCents: o.totalCents,
    trackingNumber: o.trackingNumber,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
    business: o.businessId ? { name: o.businessId.name, slug: o.businessId.slug } : null,
  }));
}

export async function getBuyerOrder(orderId: string, buyerId: string) {
  await connectToDatabase();
  const order = await Order.findOne({ _id: orderId, buyerId })
    .populate("businessId", "name slug")
    .lean<IOrder & { _id: { toString(): string }; businessId?: { name: string; slug: string } }>();
  if (!order) return null;
  const items = await OrderItem.find({ orderId }).lean<IOrderItem[]>();
  return {
    id: order._id.toString(),
    status: order.status,
    fulfillmentType: order.fulfillmentType,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    carrier: order.carrier,
    service: order.service,
    trackingNumber: order.trackingNumber,
    labelUrl: order.labelUrl,
    shippingAddress: order.shippingAddress,
    shippedAt: order.shippedAt ? new Date(order.shippedAt).toISOString() : undefined,
    deliveredAt: order.deliveredAt ? new Date(order.deliveredAt).toISOString() : undefined,
    createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : undefined,
    business: order.businessId ? { name: order.businessId.name, slug: order.businessId.slug } : null,
    items: items.map((it) => ({
      id: it._id.toString(),
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      snapshot: it.productSnapshot as { name?: string; images?: string[] } | undefined,
    })),
  };
}
