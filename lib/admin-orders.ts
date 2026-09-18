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
  shippingReconciled?: boolean;
  shipMode?: "self_ship" | "pickup_pack";
  shipmentId?: string;
  labelEmailedTo?: string;
  /** Set when the partner shipment could not be created after payment. Needs a retry. */
  shipmentFailedReason?: string;
  business?: { name: string; slug: string } | null;
  buyerEmail?: string;
  shippingAddress?: IOrder["shippingAddress"];
}

/**
 * Orders for the admin fulfillment view.
 *
 * `carrierCostCents` / `marginCents` are retained but are no longer a real margin:
 * Storm Lake reports retail only, so cost == what the buyer paid and the margin is 0.
 * Still admin-gated — the caller checks the role — but nothing here is a secret spread
 * any more. See docs/slpacknship.md.
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
    shippingReconciled: o.shippingReconciled,
    shipMode: o.shipMode,
    shipmentId: o.shipmentId,
    labelEmailedTo: o.labelEmailedTo,
    shipmentFailedReason: o.shipmentFailedReason,
    business: o.businessId ? { name: o.businessId.name, slug: o.businessId.slug } : null,
    buyerEmail: o.buyerId?.email,
    shippingAddress: o.shippingAddress,
  }));
}
