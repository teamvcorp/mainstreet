"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AreaRow } from "@/lib/prospects/queries";

const STATUS_STYLE: Record<string, string> = {
  covered: "bg-success/15 text-success",
  empty: "bg-accent/15 text-accent-foreground",
  failed: "bg-destructive/15 text-destructive",
  running: "bg-accent/15 text-accent-foreground",
  requested: "bg-muted text-muted-foreground",
  queued: "bg-muted text-muted-foreground",
};

export function ProspectAreaList({ areas }: { areas: AreaRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pending = areas.filter(
    (a) => a.status === "requested" || a.status === "queued" || a.status === "failed",
  ).length;

  async function act(id: string, method: "PATCH" | "DELETE") {
    if (
      method === "DELETE" &&
      !confirm(
        "Stop tracking this area?\n\nThe businesses it pulled are KEPT - they may already carry an email you typed, notes, or an opt-out. This only stops future refreshes.",
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/prospects/areas/${id}`, {
        method,
        headers: method === "PATCH" ? { "Content-Type": "application/json" } : undefined,
        body: method === "PATCH" ? JSON.stringify({ action: "requeue" }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Action failed (${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error - please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function runPass() {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/cron/prospect-ingest");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `The pass failed (${res.status}).`);
        return;
      }
      if (data.status === "noop") setNotice("Nothing queued - every area is already covered.");
      else if (data.status === "partial") {
        setNotice("Ran out of time. Nothing was lost - the areas are still queued. Run again.");
      } else {
        setNotice(
          `Done: ${(data.rowsKept ?? 0).toLocaleString()} businesses across ${data.areaKeys?.length ?? 0} area(s).`,
        );
      }
      router.refresh();
    } catch {
      setError("Network error - the pass may still be running. Refresh in a minute.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {pending > 0
            ? `${pending} area(s) waiting. One pass covers them all.`
            : "Nothing queued."}
        </p>
        <Button size="sm" onClick={runPass} disabled={running || pending === 0}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run pass now
        </Button>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Prospects</th>
              <th className="px-4 py-3">Last covered</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {areas.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/prospects?q=${encodeURIComponent(a.kind === "zip" ? a.label : a.label.split(",")[0])}`}
                    className="font-medium hover:underline"
                  >
                    {a.label}
                  </Link>
                  <div className="text-xs text-muted-foreground">{a.kind}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[a.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {a.status}
                  </span>
                  {a.error && (
                    <div className="mt-1 max-w-sm text-xs text-muted-foreground">{a.error}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {a.prospectCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {a.coveredAt ? new Date(a.coveredAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === a.id || a.status === "running"}
                      onClick={() => act(a.id, "PATCH")}
                      title="Re-queue for the next pass"
                    >
                      <RefreshCw className="size-4" /> Refresh
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === a.id || a.status === "running"}
                      onClick={() => act(a.id, "DELETE")}
                      aria-label="Stop tracking"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {areas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No areas yet. Search a city or ZIP on the Prospects page to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
