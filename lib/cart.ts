"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-side cart (Zustand + localStorage). Multi-business aware: items carry
 * their business so checkout (Phase 4) can split into per-seller sub-orders.
 * Money is in cents throughout.
 */
export interface CartItem {
  productId: string;
  variantId?: string; // which product variant (if the product has options)
  variantLabel?: string; // e.g. "M / Blue" — for display
  options?: { name: string; value: string }[];
  businessId: string;
  businessName: string;
  businessSlug: string;
  name: string;
  slug: string;
  priceCents: number; // the SELECTED variant's price when variantId is set
  quantity: number;
  weightOz?: number; // the selected variant's weight when set
  imageUrl?: string;
}

/**
 * A cart line is identified by product + variant, so two variants of the same
 * product (e.g. a Medium and a Large) are separate lines. No-variant products key
 * by productId alone.
 */
export const lineKey = (i: Pick<CartItem, "productId" | "variantId">) =>
  i.variantId ? `${i.productId}:${i.variantId}` : i.productId;

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const key = lineKey(item);
          const existing = s.items.find((i) => lineKey(i) === key);
          if (existing) {
            return {
              items: s.items.map((i) =>
                lineKey(i) === key ? { ...i, quantity: i.quantity + qty } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: qty }] };
        }),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => lineKey(i) !== key) })),
      setQty: (key, qty) =>
        set((s) => ({
          items: s.items.map((i) =>
            lineKey(i) === key ? { ...i, quantity: Math.max(1, qty) } : i,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "mainstreet-cart" },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
export const cartSubtotalCents = (items: CartItem[]) =>
  items.reduce((n, i) => n + i.priceCents * i.quantity, 0);

/** Group cart items by business — the unit checkout splits payment/shipping on. */
export function groupByBusiness(items: CartItem[]) {
  const groups = new Map<string, { businessId: string; businessName: string; businessSlug: string; items: CartItem[] }>();
  for (const i of items) {
    if (!groups.has(i.businessId)) {
      groups.set(i.businessId, {
        businessId: i.businessId,
        businessName: i.businessName,
        businessSlug: i.businessSlug,
        items: [],
      });
    }
    groups.get(i.businessId)!.items.push(i);
  }
  return [...groups.values()];
}
