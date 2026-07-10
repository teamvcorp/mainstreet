"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck, MapPin } from "lucide-react";
import { useCart, cartSubtotalCents, groupByBusiness } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, cn } from "@/lib/utils";

interface ShipOption {
  id: string;
  label: string;
  carrier: string;
  service: string;
  amountCents: number;
  deliveryDays?: number;
}
interface BusinessShipping {
  businessId: string;
  businessName: string;
  shipsOnline: boolean;
  pickupAvailable: boolean;
  options: ShipOption[];
}
interface Selection {
  mode: "ship" | "pickup";
  carrier?: string;
  service?: string;
  amountCents: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [address, setAddress] = useState({ name: "", street: "", city: "", state: "", zip: "", phone: "" });
  const [shipping, setShipping] = useState<BusinessShipping[] | null>(null);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [loadingRates, setLoadingRates] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => groupByBusiness(items), [items]);
  const subtotal = cartSubtotalCents(items);
  const shippingTotal = Object.values(selections).reduce((n, s) => n + s.amountCents, 0);

  if (mounted && items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <p className="font-serif text-2xl">Your cart is empty.</p>
        <Button className="mt-4" onClick={() => router.push("/towns")}>Explore towns</Button>
      </div>
    );
  }

  const addressComplete =
    address.name && address.street && address.city && address.state.length === 2 && /^\d{5}$/.test(address.zip) && address.phone;

  async function getRates() {
    setError(null);
    setLoadingRates(true);
    try {
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress: address,
          items: items.map((i) => ({ productId: i.productId, businessId: i.businessId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not get shipping rates.");
        return;
      }
      const ship: BusinessShipping[] = data.shipping;
      setShipping(ship);
      // Default selection per business: first ship option, else pickup.
      const next: Record<string, Selection> = {};
      for (const b of ship) {
        if (b.shipsOnline && b.options.length) {
          const o = b.options[0];
          next[b.businessId] = { mode: "ship", carrier: o.carrier, service: o.service, amountCents: o.amountCents };
        } else if (b.pickupAvailable) {
          next[b.businessId] = { mode: "pickup", amountCents: 0 };
        }
      }
      setSelections(next);
    } catch {
      setError("Something went wrong getting rates.");
    } finally {
      setLoadingRates(false);
    }
  }

  function chooseShip(b: BusinessShipping, o: ShipOption) {
    setSelections((s) => ({ ...s, [b.businessId]: { mode: "ship", carrier: o.carrier, service: o.service, amountCents: o.amountCents } }));
  }
  function choosePickup(b: BusinessShipping) {
    setSelections((s) => ({ ...s, [b.businessId]: { mode: "pickup", amountCents: 0 } }));
  }

  async function pay() {
    setError(null);
    setPaying(true);
    try {
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress: address,
          items: items.map((i) => ({ productId: i.productId, businessId: i.businessId, quantity: i.quantity })),
          selections: Object.fromEntries(
            Object.entries(selections).map(([k, v]) => [k, { mode: v.mode, carrier: v.carrier, service: v.service }]),
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setPaying(false);
        return;
      }
      window.location.href = data.url; // → Stripe hosted Checkout
    } catch {
      setError("Something went wrong starting checkout.");
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Checkout</h1>

      {/* Shipping address */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold">Shipping address</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="street">Street</Label>
            <Input id="street" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" inputMode="numeric" maxLength={5} value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
          </div>
        </div>
        <Button className="mt-4" onClick={getRates} disabled={!addressComplete || loadingRates}>
          {loadingRates ? <Loader2 className="size-4 animate-spin" /> : null}
          {shipping ? "Update shipping options" : "Get shipping options"}
        </Button>
      </section>

      {/* Per-business shipping choices */}
      {shipping?.map((b) => {
        const sel = selections[b.businessId];
        return (
          <section key={b.businessId} className="mt-4 rounded-xl border border-border bg-card p-5">
            <h3 className="font-serif font-semibold">{b.businessName}</h3>
            <div className="mt-3 space-y-2">
              {b.shipsOnline &&
                b.options.map((o) => (
                  <label key={o.id} className={cn("flex cursor-pointer items-center justify-between rounded-lg border p-3", sel?.mode === "ship" && sel.carrier === o.carrier && sel.service === o.service ? "border-primary bg-primary/5" : "border-border")}>
                    <span className="flex items-center gap-2 text-sm">
                      <Truck className="size-4 text-accent" />
                      {o.label}
                      {o.deliveryDays ? <span className="text-muted-foreground">· ~{o.deliveryDays} days</span> : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(o.amountCents)}</span>
                      <input type="radio" name={`ship-${b.businessId}`} checked={sel?.mode === "ship" && sel.carrier === o.carrier && sel.service === o.service} onChange={() => chooseShip(b, o)} className="size-4 accent-accent" />
                    </span>
                  </label>
                ))}
              {b.pickupAvailable && (
                <label className={cn("flex cursor-pointer items-center justify-between rounded-lg border p-3", sel?.mode === "pickup" ? "border-primary bg-primary/5" : "border-border")}>
                  <span className="flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-accent" /> Local pickup
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">Free</span>
                    <input type="radio" name={`ship-${b.businessId}`} checked={sel?.mode === "pickup"} onChange={() => choosePickup(b)} className="size-4 accent-accent" />
                  </span>
                </label>
              )}
              {!b.shipsOnline && !b.pickupAvailable && (
                <p className="text-sm text-muted-foreground">This shop hasn&apos;t enabled shipping or pickup yet.</p>
              )}
            </div>
          </section>
        );
      })}

      {/* Summary */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          <span>{shipping ? formatCurrency(shippingTotal) : "—"}</span>
        </div>
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-lg font-semibold">
          <span>Total</span>
          <span>{formatCurrency(subtotal + shippingTotal)}</span>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button size="lg" className="mt-4 w-full" disabled={!shipping || paying} onClick={pay}>
          {paying ? <Loader2 className="size-4 animate-spin" /> : null}
          Pay {formatCurrency(subtotal + shippingTotal)}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Secure checkout by Stripe. You&apos;ll enter card details on the next screen.
        </p>
      </section>
    </div>
  );
}
