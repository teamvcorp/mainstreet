"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart, cartCount } from "@/lib/cart";

/**
 * Header cart badge. Renders the count only after mount to avoid a hydration
 * mismatch (server has no access to the client's persisted localStorage cart).
 */
export function CartButton() {
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(items) : 0;

  return (
    <Link
      href="/cart"
      className="relative rounded-md p-2 hover:bg-primary-foreground/10"
      aria-label={`Cart${count ? ` (${count} items)` : ""}`}
    >
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
