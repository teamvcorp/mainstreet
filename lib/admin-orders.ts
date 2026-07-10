import { connectToDatabase } from "@/lib/db";
import { Order, type IOrder } from "@/lib/models/Order";
import "@/lib/models/Business";
import "@/lib/models/User";

export interface AdminOrderRow {
  id: string;
  status: string;
  fulfillmentType: "ship" | "pickup";
  createdAt?: string;
  totalCents: number;
  shippingCents: number;
  carrierCostCents?: number; // admin-only (confidential)
  marginCents?: number; // admin-only
  carrier?: string;
  service?: string;
  trackingNumber?: string;
  labelUrl?: string;
  business?: { name: string; slug: string } | null;
  buyerEmail?: string;
  shippingAddress?: IOrder["shippingAddress"];
}

/**
 * Orders for the admin fulfillment/margin view. Includes the confidential
 * carrier cost + margin — this is the ONE place they're exposed, and only after
 * an admin role check by the caller.
 */
export async function getOrdersForAdmin(): Promise<AdminOrderRow[]> {
  await connectToDatabase();
  const orders = await Order.find({ status: { $ne: "pending" } })
    .select("+carrierCostCents +platformFeeCents")
    .sort({ createdAt: -1 })
    .limit(300)
    .populate("businessId", "name slug")
    .populate("buyerId", "email")
    .lean<
      (IOrder & {
        _id: { toString(): string };
        businessId?: { name: string; slug: string };
        buyerId?: { email?: string };
      })[]
    >();

  return orders.map((o) => ({
    id: o._id.toString(),
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
    totalCents: o.totalCents,
    shippingCents: o.shippingCents,
    carrierCostCents: o.carrierCostCents,
    marginCents: o.platformFeeCents,
    carrier: o.carrier,
    service: o.service,
    trackingNumber: o.trackingNumber,
    labelUrl: o.labelUrl,
    business: o.businessId ? { name: o.businessId.name, slug: o.businessId.slug } : null,
    buyerEmail: o.buyerId?.email,
    shippingAddress: o.shippingAddress,
  }));
}
