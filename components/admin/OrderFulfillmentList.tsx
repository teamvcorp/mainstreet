"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, cn } from "@/lib/utils";
import type { AdminOrderRow } from "@/lib/admin-orders";

const FILTERS = ["to_ship", "all", "shipped", "delivered"] as const;
type Filter = (typeof FILTERS)[number];

export function OrderFulfillmentList({ orders }: { orders: AdminOrderRow[] }) {
  const [filter, setFilter] = useState<Filter>("to_ship");
  const shown = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "to_ship") return o.fulfillmentType === "ship" && (o.status === "paid" || o.status === "processing");
    if (filter === "shipped") return o.status === "shipped";
    if (filter === "delivered") return o.status === "delivered";
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium capitalize",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {shown.map((o) => (
          <OrderRow key={o.id} order={o} />
        ))}
        {shown.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Nothing here.
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: AdminOrderRow }) {
  const router = useRouter();
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [labelUrl, setLabelUrl] = useState(order.labelUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = order.shippingAddress;

  async function uploadLabel(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-label", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Upload failed.");
      else setLabelUrl(data.url);
    } finally {
      setBusy(false);
    }
  }

  async function act(body: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {order.business?.name ?? "Order"}{" "}
            <span className="text-xs uppercase tracking-wide text-muted-foreground">· {order.fulfillmentType}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {order.createdAt ? new Date(order.createdAt).toLocaleString() : ""} · {order.buyerEmail}
          </p>
          {a && (
            <p className="mt-1 text-sm text-muted-foreground">
              Ship to: {a.name}, {a.street}, {a.city} {a.state} {a.zip} · {a.phone}
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize">{order.status}</span>
          <p className="mt-1 text-muted-foreground">
            Total {formatCurrency(order.totalCents)}
          </p>
          {typeof order.marginCents === "number" && (
            <p className="text-xs text-success">margin {formatCurrency(order.marginCents)}</p>
          )}
        </div>
      </div>

      {/* Ship form (only for ship orders not yet delivered) */}
      {order.fulfillmentType === "ship" && order.status !== "delivered" && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <div>
            <Label htmlFor={`tn-${order.id}`}>Tracking #</Label>
            <Input id={`tn-${order.id}`} value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`ca-${order.id}`}>Carrier</Label>
            <Input id={`ca-${order.id}`} placeholder="USPS / UPS / FedEx" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div>
            <Label>Label</Label>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
                <Upload className="size-4" /> {labelUrl ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadLabel(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {labelUrl && (
                <a href={labelUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                  view
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.fulfillmentType === "ship" && order.status !== "delivered" && (
          <Button
            size="sm"
            disabled={busy || !tracking}
            onClick={() => act({ action: "ship", trackingNumber: tracking, carrier: carrier || undefined, labelUrl: labelUrl || undefined })}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} Mark shipped
          </Button>
        )}
        {order.status !== "delivered" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: "deliver" })}>
            <CheckCircle2 className="size-4" /> Mark delivered
          </Button>
        )}
      </div>
    </div>
  );
}
