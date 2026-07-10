import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck, MapPin, Package } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { getBuyerOrder } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Order detail" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const order = user ? await getBuyerOrder(id, user.id) : null;
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground">
        ← All orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-3xl font-semibold">
          {order.business?.name ?? "Order"}
        </h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium capitalize">{order.status}</span>
      </div>

      {/* Fulfillment */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
        {order.fulfillmentType === "pickup" ? (
          <p className="flex items-center gap-2"><MapPin className="size-4 text-accent" /> Local pickup</p>
        ) : (
          <div className="space-y-1">
            <p className="flex items-center gap-2">
              <Truck className="size-4 text-accent" /> {order.carrier ? `${order.carrier} ${order.service ?? ""}` : "Shipping"}
            </p>
            {order.trackingNumber ? (
              <p className="text-muted-foreground">Tracking: {order.trackingNumber}</p>
            ) : (
              <p className="text-muted-foreground">Tracking will appear here once it ships.</p>
            )}
            {order.shippingAddress && (
              <p className="text-muted-foreground">
                Ship to: {order.shippingAddress.name}, {order.shippingAddress.street},{" "}
                {order.shippingAddress.city} {order.shippingAddress.state} {order.shippingAddress.zip}
              </p>
            )}
          </div>
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

      {/* Totals */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(order.subtotalCents)}</span></div>
        <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shippingCents > 0 ? formatCurrency(order.shippingCents) : "Free"}</span></div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span>{formatCurrency(order.totalCents)}</span></div>
      </div>
    </div>
  );
}
