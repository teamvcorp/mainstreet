import type { Metadata } from "next";
import { listTownsForAdmin } from "@/lib/admin-stats";
import { TownAdminList } from "@/components/admin/TownAdminList";

export const metadata: Metadata = { title: "Towns" };

export default async function AdminTownsPage() {
  const towns = await listTownsForAdmin();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Towns</h1>
      <p className="mb-6 text-muted-foreground">
        Most towns are auto-created from business addresses. Add taglines/heroes, hide, or add towns manually.
      </p>
      <TownAdminList towns={towns} />
    </div>
  );
}
