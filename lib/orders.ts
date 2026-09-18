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

export interface PreparedCheckout {
  orderIds: string[];
  /** Authoritative, server-computed amount. This is what the buyer is charged. */
  grandTotalCents: number;
}

/**
 * Create one PENDING order per business from the cart.
 *
 * Prices, stock and parcel weights all come from the DB, never the client, and
 * shipping is re-quoted server-side. The quote id we charge against is persisted so
 * the label can later be bought for that exact rate (Storm Lake quotes are
 * single-use, ~30 min TTL).
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
        variants?: {
          _id: { toString(): string };
          options: { name: string; value: string }[];
          priceCents: number;
          inventoryQty: number;
          trackInventory: boolean;
          weightOz?: number;
          isActive: boolean;
        }[];
      }[]
    >();
    const pMap = new Map(products.map((p) => [p._id.toString(), p]));

    let subtotal = 0;
    const itemDocs: Partial<IOrderItem>[] = [];
    for (const line of lines) {
      const p = pMap.get(line.productId);
      if (!p) throw new Error("NOT_FOUND");

      // Resolve the chosen variant (authoritative price/stock/weight come from the DB).
      const variant = line.variantId
        ? (p.variants ?? []).find((v) => v._id.toString() === line.variantId && v.isActive)
        : undefined;
      if (line.variantId && !variant) throw new Error("NOT_FOUND");
      // A product WITH active variants must be bought by variant — reject a bare productId.
      if (!line.variantId && (p.variants ?? []).some((v) => v.isActive)) throw new Error("NOT_FOUND");

      const unitPriceCents = variant ? variant.priceCents : p.priceCents;
      const tracks = variant ? variant.trackInventory : p.trackInventory;
      const stock = variant ? variant.inventoryQty : p.inventoryQty;
      if (tracks && stock < line.quantity) throw new Error("OUT_OF_STOCK");

      const variantLabel = variant ? variant.options.map((o) => o.value).join(" / ") : undefined;
      subtotal += unitPriceCents * line.quantity;
      itemDocs.push({
        productId: p._id as unknown as IOrderItem["productId"],
        ...(variant ? { variantId: variant._id as unknown as IOrderItem["variantId"] } : {}),
        quantity: line.quantity,
        unitPriceCents,
        productSnapshot: {
          name: p.name,
          slug: p.slug,
          images: p.images,
          weightOz: variant?.weightOz ?? p.weightOz,
          dimensions: p.dimensions,
          ...(variant ? { variantLabel, options: variant.options } : {}),
        },
      });
    }

    const choice = input.selections[businessId];
    if (!choice) throw new Error("SHIPPING_SELECTION_MISSING");
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
      // Retail is all the partner ever reports, so carrierCost == shipping and the
      // platform fee is 0: the shipping spread belongs to Storm Lake now.
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
      shipQuoteId: ship.quoteId,
      shipQuoteExpiresAt: ship.quoteExpiresAt,
      shipMode: ship.shipMode,
    });

    await OrderItem.insertMany(itemDocs.map((d) => ({ ...d, orderId: order._id })));
    orderIds.push(order._id.toString());
  }

  return { orderIds, grandTotalCents: grand };
}

/**
 * Discard prior PENDING orders (+ their items) for a buyer — used when a buyer
 * edits shipping and we recreate the checkout, so no orphan pending orders linger.
 * Scoped to buyer + pending so a paid order can never be deleted.
 */
export async function discardPendingOrders(buyerId: string, orderIds: string[]) {
  if (!orderIds.length) return;
  await connectToDatabase();
  const rows = await Order.find({ _id: { $in: orderIds }, buyerId, status: "pending" }).select("_id");
  const ids = rows.map((r) => r._id);
  if (!ids.length) return;
  await OrderItem.deleteMany({ orderId: { $in: ids } });
  await Order.deleteMany({ _id: { $in: ids } });
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

export async function markOrderPaid(
  orderId: string,
  piId: string,
  extra?: { transferId?: string; customerId?: string; paymentMethodId?: string },
) {
  await connectToDatabase();
  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        status: "paid",
        stripePaymentIntentId: piId,
        ...(extra?.transferId ? { stripeTransferId: extra.transferId } : {}),
        ...(extra?.customerId ? { stripeCustomerId: extra.customerId } : {}),
        ...(extra?.paymentMethodId ? { stripePaymentMethodId: extra.paymentMethodId } : {}),
      },
    },
  );
}

/** Decrement inventory for a paid order's items (best-effort). */
export async function decrementInventoryForOrder(orderId: string) {
  await connectToDatabase();
  const items = await OrderItem.find({ orderId }).select("productId variantId quantity").lean<
    { productId: { toString(): string }; variantId?: { toString(): string }; quantity: number }[]
  >();
  for (const it of items) {
    if (it.variantId) {
      // Decrement the specific variant subdoc (only if it tracks inventory).
      await Product.updateOne(
        {
          _id: it.productId.toString(),
          variants: { $elemMatch: { _id: it.variantId.toString(), trackInventory: true } },
        },
        { $inc: { "variants.$.inventoryQty": -it.quantity } },
      );
    } else {
      await Product.updateOne(
        { _id: it.productId.toString(), trackInventory: true },
        { $inc: { inventoryQty: -it.quantity } },
      );
    }
  }
}

// --- Buyer-facing (safe DTOs, no confidential fields) --------------------
export async function listBuyerOrders(buyerId: string) {
  await connectToDatabase();
  // Hide never-paid `pending` orders (abandoned checkouts) — an order shows up once paid.
  const orders = await Order.find({ buyerId, status: { $ne: "pending" } })
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
      snapshot: it.productSnapshot as
        | { name?: string; images?: string[]; variantLabel?: string }
        | undefined,
    })),
  };
}
