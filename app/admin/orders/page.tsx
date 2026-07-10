import type { Metadata } from "next";
import { getOrdersForAdmin } from "@/lib/admin-orders";
import { OrderFulfillmentList } from "@/components/admin/OrderFulfillmentList";

export const metadata: Metadata = { title: "Fulfillment" };

// Admin-only via proxy.ts.
export default async function AdminOrdersPage() {
  const orders = await getOrdersForAdmin();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Fulfillment</h1>
      <p className="mb-6 text-muted-foreground">
        SL Pack &amp; Ship: attach the tracking number and label to each paid order. The seller and
        buyer see it instantly, and the buyer gets a &ldquo;shipped&rdquo; email. Margins shown are
        admin-only.
      </p>
      <OrderFulfillmentList orders={orders} />
    </div>
  );
}
