"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Seller marks a local-pickup order as picked up (→ delivered). */
export function PickupButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mark() {
    setBusy(true);
    const res = await fetch(`/api/seller/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "picked_up" }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <Button onClick={mark} disabled={busy}>
      <CheckCircle2 className="size-4" /> Mark picked up
    </Button>
  );
}
