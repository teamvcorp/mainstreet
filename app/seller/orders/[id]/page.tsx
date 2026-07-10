import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Truck, MapPin, Package, Printer } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { getSellerOrder } from "@/lib/seller-orders";
import { PickupButton } from "@/components/seller/PickupButton";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

export default async function SellerOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  const order = await getSellerOrder(id, biz._id.toString());
  if (!order) notFound();
  const a = order.shippingAddress;

  return (
    <div className="max-w-2xl">
      <Link href="/seller/orders" className="text-sm text-muted-foreground hover:text-foreground">
        ← All orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-3xl font-semibold">Order</h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium capitalize">{order.status}</span>
      </div>

      {/* Fulfillment */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
        {order.fulfillmentType === "pickup" ? (
          <>
            <p className="flex items-center gap-2 font-medium">
              <MapPin className="size-4 text-accent" /> Local pickup
            </p>
            {a && <p className="mt-1 text-muted-foreground">Customer: {a.name} · {a.phone}</p>}
            {order.status !== "delivered" && (
              <div className="mt-3">
                <PickupButton orderId={order.id} />
              </div>
            )}
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 font-medium">
              <Truck className="size-4 text-accent" /> {order.carrier ? `${order.carrier} ${order.service ?? ""}` : "Shipping"}
            </p>
            {a && (
              <p className="mt-1 text-muted-foreground">
                Ship to: {a.name}, {a.street}, {a.city} {a.state} {a.zip} · {a.phone}
              </p>
            )}
            <p className="mt-1 text-muted-foreground">
              {order.trackingNumber ? `Tracking: ${order.trackingNumber}` : "Tracking will appear once SL Pack & Ship processes it."}
            </p>
            {order.labelUrl && (
              <a
                href={order.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Printer className="size-4" /> View / reprint label
              </a>
            )}
          </>
        )}
      </div>

      {/* Items */}
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {order.items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 p-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Package className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{it.snapshot?.name ?? "Item"}</p>
              <p className="text-sm text-muted-foreground">Qty {it.quantity}</p>
            </div>
            <span className="font-medium">{formatCurrency(it.unitPriceCents * it.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Product subtotal</span><span>{formatCurrency(order.subtotalCents)}</span></div>
        <p className="mt-2 text-xs text-muted-foreground">
          Shipping is handled by MainStreet — you keep 100% of your product sales.
        </p>
      </div>
    </div>
  );
}
