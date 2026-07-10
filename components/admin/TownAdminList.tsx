"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminTownRow } from "@/lib/admin-stats";

export function TownAdminList({ towns }: { towns: AdminTownRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [state, setState] = useState("");

  async function createTown(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("create");
    const res = await fetch("/api/admin/towns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, state }),
    });
    setBusy(null);
    if (res.ok) {
      setName("");
      setState("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not create town.");
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch(`/api/admin/towns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this town?")) return;
    setBusy(id);
    const res = await fetch(`/api/admin/towns/${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Could not delete.");
    }
  }

  return (
    <div>
      <form onSubmit={createTown} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Add a town</label>
          <div className="mt-1 flex gap-2">
            <Input placeholder="Town name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input placeholder="ST" maxLength={2} className="w-20" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} required />
            <Button type="submit" disabled={busy === "create"}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
        </div>
      </form>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Town</th>
              <th className="px-4 py-3">Tagline</th>
              <th className="px-4 py-3 text-right">Shops</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {towns.map((t) => (
              <tr key={t.id} className={t.isActive ? "" : "opacity-60"}>
                <td className="px-4 py-3">
                  <Link href={`/town/${t.slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium hover:underline">
                    {t.name}, {t.state} <ExternalLink className="size-3" />
                  </Link>
                  {t.autoCreated && <div className="text-xs text-muted-foreground">auto</div>}
                </td>
                <td className="px-4 py-3">
                  <input
                    defaultValue={t.tagline ?? ""}
                    placeholder="Add a tagline…"
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    onBlur={(e) => {
                      if (e.target.value !== (t.tagline ?? "")) patch(t.id, { tagline: e.target.value });
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-right">{t.businessCount}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" disabled={busy === t.id} onClick={() => patch(t.id, { isActive: !t.isActive })}>
                      {t.isActive ? "Hide" : "Show"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === t.id} onClick={() => remove(t.id)} aria-label="Delete">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
