"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SuggestionRow } from "@/lib/admin-stats";

const STATUSES = ["contacted", "joined", "declined"] as const;

export function SuggestionAdminList({ suggestions }: { suggestions: SuggestionRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const res = await fetch(`/api/admin/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  if (suggestions.length === 0) {
    return <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No suggestions yet.</div>;
  }

  return (
    <ul className="space-y-3">
      {suggestions.map((s) => (
        <li key={s.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{s.businessName}</p>
              <p className="text-sm text-muted-foreground">
                {[s.category, s.townName, s.phone, s.website].filter(Boolean).join(" · ")}
              </p>
              {s.searchQuery && <p className="text-xs text-muted-foreground">searched: “{s.searchQuery}”</p>}
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize">{s.status}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUSES.map((st) => (
              <Button key={st} size="sm" variant={s.status === st ? "default" : "outline"} disabled={busy === s.id} onClick={() => setStatus(s.id, st)}>
                <span className="capitalize">{st}</span>
              </Button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
