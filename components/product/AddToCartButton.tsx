"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type CartItem } from "@/lib/cart";

export function AddToCartButton({
  item,
  disabled,
  outOfStock,
}: {
  item: Omit<CartItem, "quantity">;
  disabled?: boolean;
  outOfStock?: boolean;
}) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);

  if (outOfStock) {
    return (
      <Button size="lg" variant="outline" disabled>
        Out of stock
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      disabled={disabled}
      onClick={() => {
        add(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
    >
      {added ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
      {added ? "Added to cart" : "Add to cart"}
    </Button>
  );
}
