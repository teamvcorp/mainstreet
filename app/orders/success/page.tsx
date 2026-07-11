"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/I18nProvider";

/** Post-payment landing. Clears the cart (payment succeeded on Stripe). */
export default function OrderSuccessPage() {
  const t = useT();
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
      <CheckCircle2 className="mx-auto size-12 text-success" />
      <h1 className="mt-4 font-serif text-3xl font-semibold">{t("orders.successTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("orders.successBody")}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link href="/orders">{t("orders.viewOrders")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/towns">{t("orders.keepExploring")}</Link>
        </Button>
      </div>
    </div>
  );
}
