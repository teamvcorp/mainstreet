import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listProspectAreas } from "@/lib/prospects/queries";
import { ProspectAreaList } from "@/components/admin/ProspectAreaList";

export const metadata: Metadata = { title: "Prospect coverage" };

// Admin-only via proxy.ts. Dynamic rendering is inherited from app/admin/layout.tsx.
export default async function AdminProspectAreasPage() {
  const areas = await listProspectAreas();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href="/admin/prospects"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Prospects
      </Link>
      <h1 className="font-serif text-3xl font-semibold">Coverage</h1>
      <p className="mb-6 max-w-2xl text-muted-foreground">
        Cities and ZIP codes pulled from the state registry. Coverage grows only as you request
        it &mdash; one pass satisfies every queued area at once, so queue everything you want
        before running one.
      </p>
      <ProspectAreaList areas={areas} />
    </div>
  );
}
