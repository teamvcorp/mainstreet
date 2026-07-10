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
  businessId: string;
  businessName: string;
  businessSlug: string;
  name: string;
  slug: string;
  priceCents: number;
  quantity: number;
  weightOz?: number;
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: qty }] };
        }),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      setQty: (productId, qty) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i,
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
