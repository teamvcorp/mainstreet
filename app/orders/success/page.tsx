"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

/** Post-payment landing. Clears the cart (payment succeeded on Stripe). */
export default function OrderSuccessPage() {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
      <CheckCircle2 className="mx-auto size-12 text-success" />
      <h1 className="mt-4 font-serif text-3xl font-semibold">Thank you for shopping local!</h1>
      <p className="mt-2 text-muted-foreground">
        Your order is confirmed. We&apos;ve emailed your receipt, and each shop is being notified to
        prepare your items.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link href="/orders">View my orders</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/towns">Keep exploring</Link>
        </Button>
      </div>
    </div>
  );
}
