import type { Metadata } from "next";
import { getSearchGaps } from "@/lib/admin-stats";

export const metadata: Metadata = { title: "Demand gaps" };

// Admin-only via proxy.ts.
export default async function AdminGapsPage() {
  const gaps = await getSearchGaps();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Demand gaps</h1>
      <p className="mb-6 text-muted-foreground">
        What shoppers searched for and didn&apos;t find locally — your business-recruitment lead list.
      </p>
      {gaps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No search exits recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Search</th>
                <th className="px-4 py-3">Town</th>
                <th className="px-4 py-3 text-right">Searches</th>
                <th className="px-4 py-3 text-right">→ Amazon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {gaps.map((g, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium">{g.query}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.townName ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{g.count}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{g.amazonExits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
