"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingCart, Package } from "lucide-react";
import { useCart, cartSubtotalCents, groupByBusiness } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6" />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <ShoppingCart className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-3 font-serif text-2xl font-semibold">Your cart is empty</h1>
        <p className="mt-1 text-muted-foreground">Discover local shops and add something you love.</p>
        <Button asChild className="mt-5">
          <Link href="/towns">Explore towns</Link>
        </Button>
      </div>
    );
  }

  const groups = groupByBusiness(items);
  const subtotal = cartSubtotalCents(items);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Your cart</h1>

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <section key={g.businessId} className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <Link href={`/store/${g.businessSlug}`} className="font-serif font-semibold hover:underline">
                {g.businessName}
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {g.items.map((i) => (
                <li key={i.productId} className="flex items-center gap-4 p-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {i.imageUrl ? (
                      <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/store/${g.businessSlug}/${i.slug}`} className="truncate font-medium hover:underline">
                      {i.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{formatCurrency(i.priceCents)}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border">
                    <button className="p-2 hover:bg-muted" onClick={() => setQty(i.productId, i.quantity - 1)} aria-label="Decrease">
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm">{i.quantity}</span>
                    <button className="p-2 hover:bg-muted" onClick={() => setQty(i.productId, i.quantity + 1)} aria-label="Increase">
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <div className="w-20 text-right font-medium">{formatCurrency(i.priceCents * i.quantity)}</div>
                  <button className="p-2 text-muted-foreground hover:text-destructive" onClick={() => remove(i.productId)} aria-label="Remove">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-xl font-semibold">{formatCurrency(subtotal)}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Shipping is calculated per shop at checkout. You&apos;ll choose a delivery option (or local
          pickup) for each business.
        </p>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
      </div>
    </div>
  );
}
