import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { getSellerOrders } from "@/lib/seller-orders";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  paid: "bg-accent/15 text-accent-foreground",
  processing: "bg-accent/15 text-accent-foreground",
  shipped: "bg-primary/10 text-primary",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
  refunded: "bg-destructive/15 text-destructive",
};

export default async function SellerOrdersPage() {
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  const orders = await getSellerOrders(biz._id.toString());

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl font-semibold">Orders</h1>
      <p className="mb-6 text-muted-foreground">Incoming orders for {biz.name}.</p>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Package className="mx-auto size-8" />
          <p className="mt-2">No orders yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/seller/orders/${o.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {o.shippingAddress?.name ?? "Order"}{" "}
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">· {o.fulfillmentType}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ""}
                    {o.trackingNumber ? ` · ${o.trackingNumber}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[o.status] ?? ""}`}>
                    {o.status}
                  </span>
                  <span className="font-medium">{formatCurrency(o.totalCents)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
