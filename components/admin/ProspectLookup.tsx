"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  query: string;
  includeExcluded: boolean;
  area: { key: string; label: string } | null;
  areaStatus: string | null;
  areaError?: string;
  supported: boolean;
  total: number;
  shown: number;
  excluded: number;
  withEmail: number;
}

/**
 * The search box, plus the "we have not pulled that area yet" flow.
 *
 * Searching NAVIGATES rather than fetching, so a result page is linkable and the back button
 * works. Only queue/ingest are client-side mutations, and both follow the house pattern:
 * fetch() then router.refresh(). No Server Actions - this repo has none.
 */
export function ProspectLookup(props: Props) {
  const router = useRouter();
  const [q, setQ] = useState(props.query);
  const [busy, setBusy] = useState<null | "queue" | "ingest">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(nextQuery: string, excluded: boolean) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (excluded) params.set("excluded", "1");
    startTransition(() => router.push(`/admin/prospects?${params.toString()}`));
  }

  async function queueArea() {
    setBusy("queue");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/prospects/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: props.query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Could not queue that area (${res.status}).`);
        return;
      }
      setNotice("Queued. Run a pass to pull it from the state registry.");
      router.refresh();
    } catch {
      setError("Network error - please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function runIngest() {
    setBusy("ingest");
    setError(null);
    setNotice(null);
    try {
      // One pass satisfies EVERY queued area at once, so this is never per-area work.
      const res = await fetch("/api/cron/prospect-ingest");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `The ingest pass failed (${res.status}).`);
        return;
      }
      if (data.status === "noop") {
        setNotice("Nothing queued - every area is already covered.");
      } else if (data.status === "partial") {
        setNotice(
          `Ran out of time after ${(data.linesRead ?? 0).toLocaleString()} rows. Nothing was lost - the areas are still queued, so run it again.`,
        );
      } else {
        setNotice(
          `Done: ${(data.rowsKept ?? 0).toLocaleString()} businesses found across ${data.areaKeys?.length ?? 0} area(s).`,
        );
      }
      router.refresh();
    } catch {
      setError("Network error - the pass may still be running. Refresh in a minute.");
    } finally {
      setBusy(null);
    }
  }

  const covered = props.areaStatus === "covered" || props.areaStatus === "empty";
  const neverRequested = !!props.area && props.areaStatus === null;
  const waiting =
    props.areaStatus === "requested" ||
    props.areaStatus === "queued" ||
    props.areaStatus === "running";

  return (
    <div className="mb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q, props.includeExcluded);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="City (e.g. Storm Lake) or ZIP (e.g. 50588)"
            className="w-full bg-transparent text-sm focus:outline-none"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Look up
        </Button>
        {props.query && props.total > 0 && (
          <a
            href={`/api/admin/prospects/export?q=${encodeURIComponent(props.query)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:shadow-md"
          >
            <Download className="size-4" /> CSV
          </a>
        )}
      </form>

      {error && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}

      {props.query && !props.area && (
        <p className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Enter a city name (e.g. <strong>Storm Lake</strong>) or a 5-digit ZIP code (e.g.{" "}
          <strong>50588</strong>).
        </p>
      )}

      {props.area && !props.supported && (
        <p className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <AlertTriangle className="mr-1 inline size-4" />
          Only Iowa is supported right now &mdash; the source is the Iowa Secretary of State
          register of active business entities.
        </p>
      )}

      {props.area && props.supported && (
        <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{props.area.label}</p>
              <p className="text-muted-foreground">
                {props.total.toLocaleString()} on file
                {props.excluded > 0 && ` · ${props.excluded.toLocaleString()} filtered out`}
                {props.withEmail > 0 && ` · ${props.withEmail.toLocaleString()} with email`}
                {props.shown < props.total && ` · showing ${props.shown.toLocaleString()}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {props.total > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => go(props.query, !props.includeExcluded)}
                  disabled={pending}
                >
                  {props.includeExcluded ? "Hide filtered-out" : "Show filtered-out"}
                </Button>
              )}
              {neverRequested && (
                <Button size="sm" variant="outline" onClick={queueArea} disabled={busy !== null}>
                  {busy === "queue" && <Loader2 className="size-4 animate-spin" />}
                  Queue this area
                </Button>
              )}
              {(neverRequested || waiting) && (
                <Button size="sm" onClick={runIngest} disabled={busy !== null}>
                  {busy === "ingest" && <Loader2 className="size-4 animate-spin" />}
                  Run pass now
                </Button>
              )}
              {covered && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                  <CheckCircle2 className="size-3" /> Covered
                </span>
              )}
            </div>
          </div>

          {neverRequested && (
            <p className="mt-3 border-t border-border pt-3 text-muted-foreground">
              We have not pulled <strong>{props.area.label}</strong> from the state registry yet.
              {props.total > 0 &&
                " The rows below arrived with a neighbouring area, so this list is probably incomplete."}{" "}
              Queue it to include it in the next pass.
            </p>
          )}
          {waiting && (
            <p className="mt-3 border-t border-border pt-3 text-muted-foreground">
              Queued. A pass downloads about 205 MB from the State of Iowa and usually finishes in
              under a minute &mdash; and it satisfies <strong>every</strong> queued area in the
              same run, so queue everything you want before starting one.
            </p>
          )}
          {props.areaError && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {props.areaError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
