"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, ShieldOff, Trash2, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminBusinessRow } from "@/lib/admin";

export function BusinessAdminList({ businesses }: { businesses: AdminBusinessRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Local copy so verify/suspend update instantly (optimistic), even before refresh.
  const [rows, setRows] = useState<AdminBusinessRow[]>(businesses);

  const filtered = rows.filter((b) => {
    if (!q) return true;
    const hay = `${b.name} ${b.town?.name ?? ""} ${b.town?.state ?? ""} ${b.zip ?? ""} ${b.owner?.email ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  function applyLocal(id: string, action: string) {
    setRows((prev) =>
      action === "delete"
        ? prev.filter((b) => b.id !== id)
        : prev.map((b) =>
            b.id !== id
              ? b
              : action === "verify"
                ? { ...b, verified: true }
                : action === "unverify"
                  ? { ...b, verified: false }
                  : action === "suspend"
                    ? { ...b, isActive: false }
                    : { ...b, isActive: true },
          ),
    );
  }

  async function act(id: string, method: "PATCH" | "DELETE", action: string) {
    if (method === "DELETE" && !confirm("Permanently delete this business, its products, and its events?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method,
        headers: method === "PATCH" ? { "Content-Type": "application/json" } : undefined,
        body: method === "PATCH" ? JSON.stringify({ action }) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Action failed (${res.status}).`);
        return;
      }
      applyLocal(id, method === "DELETE" ? "delete" : action);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name, town, ZIP, or owner email…"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Town</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((b) => (
              <tr key={b.id} className={b.isActive ? "" : "opacity-60"}>
                <td className="px-4 py-3">
                  {b.isActive ? (
                    // Public storefront only exists while active — avoid a dead link when suspended.
                    <Link href={`/store/${b.slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium hover:underline">
                      {b.name} <ExternalLink className="size-3" />
                    </Link>
                  ) : (
                    <span className="font-medium" title="Storefront hidden while suspended">
                      {b.name}
                    </span>
                  )}
                  {b.category && <div className="text-xs text-muted-foreground">{b.category}</div>}
                </td>
                <td className="px-4 py-3">
                  {b.town ? `${b.town.name}, ${b.town.state}` : "—"}
                  {b.zip && <div className="text-xs text-muted-foreground">{b.zip}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{b.owner?.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {b.verified ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Verified</span>
                    ) : (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-foreground">Unverified</span>
                    )}
                    {!b.isActive && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">Suspended</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {!b.verified ? (
                      <Button size="sm" variant="outline" disabled={busyId === b.id} onClick={() => act(b.id, "PATCH", "verify")}>
                        <BadgeCheck className="size-4" /> Verify
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={busyId === b.id} onClick={() => act(b.id, "PATCH", "unverify")}>
                        Unverify
                      </Button>
                    )}
                    {b.isActive ? (
                      <Button size="sm" variant="ghost" disabled={busyId === b.id} onClick={() => act(b.id, "PATCH", "suspend")}>
                        <ShieldOff className="size-4" /> Suspend
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={busyId === b.id} onClick={() => act(b.id, "PATCH", "activate")}>
                        Reactivate
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={busyId === b.id} onClick={() => act(b.id, "DELETE", "delete")} aria-label="Delete">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No businesses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
