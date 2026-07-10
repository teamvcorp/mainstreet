import type { Metadata } from "next";
import { getBusinessesForAdmin } from "@/lib/admin";
import { BusinessAdminList } from "@/components/admin/BusinessAdminList";

export const metadata: Metadata = { title: "Businesses" };

// Admin-only via proxy.ts.
export default async function AdminBusinessesPage() {
  const businesses = await getBusinessesForAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Businesses</h1>
      <p className="mb-6 text-muted-foreground">
        Every shop, grouped by town (auto-created from each business&apos;s address). Verify real
        businesses; suspend or delete unverified/spam listings.
      </p>
      <BusinessAdminList businesses={businesses} />
    </div>
  );
}
