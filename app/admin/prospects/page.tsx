import type { Metadata } from "next";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { lookupProspects, getProspectStats } from "@/lib/prospects/queries";
import { ProspectLookup } from "@/components/admin/ProspectLookup";
import { ProspectResults } from "@/components/admin/ProspectResults";

export const metadata: Metadata = { title: "Prospects" };

// Admin-only via proxy.ts. Dynamic rendering is inherited from app/admin/layout.tsx.
export default async function AdminProspectsPage(props: PageProps<"/admin/prospects">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 120) : "";
  const includeExcluded = sp.excluded === "1";

  const [result, stats] = await Promise.all([
    lookupProspects({ query: q, includeExcluded }),
    getProspectStats(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Prospects</h1>
          <p className="mb-6 max-w-2xl text-muted-foreground">
            Look up businesses by city or ZIP to build a mailing list. Records come from the
            Iowa Secretary of State&apos;s public register of active business entities.
          </p>
        </div>
        <Link
          href="/admin/prospects/areas"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:shadow-md"
        >
          <MapPinned className="size-4" />
          Coverage ({stats.covered}/{stats.areas})
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Prospects on file", value: stats.prospects },
          { label: "Mailable", value: stats.mailable },
          { label: "With email", value: stats.withEmail },
          { label: "Areas covered", value: stats.covered },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 font-serif text-xl font-semibold">{k.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <ProspectLookup
        query={q}
        includeExcluded={includeExcluded}
        area={result.area ? { key: result.area.key, label: result.area.label } : null}
        areaStatus={result.areaStatus}
        areaError={result.areaError}
        supported={result.supported}
        total={result.total}
        shown={result.rows.length}
        excluded={result.excluded}
        withEmail={result.withEmail}
      />

      {q && result.area && result.rows.length > 0 && (
        <ProspectResults rows={result.rows} truncated={result.truncated} />
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        Source: Iowa Secretary of State, Active Iowa Business Entities (data.iowa.gov dataset
        554), licensed{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          CC BY 4.0
        </a>
        . Sole proprietorships and partnerships are not required to register and do not appear.
      </p>
    </div>
  );
}
