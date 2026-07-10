"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { SuggestBusinessForm } from "@/components/search/SuggestBusinessForm";

interface AdjacentTown {
  name: string;
  state: string;
  slug: string;
}

/**
 * The 3-layer exit shown when platform search finds nothing (Addendum A):
 *   1) Suggest a business (growth, not a dead end)
 *   2) Browse adjacent towns (widen discovery, still on-platform)
 *   3) Amazon fallback (the ONLY external link — quiet, last)
 * Each layer's exit is tracked for the /admin/gaps demand report.
 */
export function SearchEmptyState({
  query,
  townSlug,
  adjacentTowns,
  amazonUrl,
}: {
  query: string;
  townSlug?: string;
  adjacentTowns: AdjacentTown[];
  amazonUrl?: string | null;
}) {
  useEffect(() => {
    // Log the empty view once (fire-and-forget).
    void fetch("/api/search/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, townSlug, type: "bounced" }),
    });
  }, [query, townSlug]);

  function logExit(type: "amazon" | "adjacent_town") {
    void fetch("/api/search/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, townSlug, type }),
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Layer 1 — suggest a business */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-xl font-semibold">
          No local results for “{query}”{townSlug ? " here" : ""} yet.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Know a local business that carries this? Nominate them — we&apos;ll invite them to MainStreet.
        </p>
        <div className="mt-4">
          <SuggestBusinessForm searchQuery={query} townSlug={townSlug} />
        </div>
      </section>

      {/* Layer 2 — adjacent towns */}
      {adjacentTowns.length > 0 && (
        <section>
          <h3 className="font-serif text-lg font-semibold">Check nearby towns</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {adjacentTowns.map((t) => (
              <Link
                key={t.slug}
                href={`/town/${t.slug}`}
                onClick={() => logExit("adjacent_town")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <MapPin className="size-3.5 text-accent" />
                {t.name}, {t.state}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Layer 3 — Amazon fallback (quiet, last) */}
      {amazonUrl && (
        <section className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Can&apos;t find it locally?{" "}
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logExit("amazon")}
              className="inline-flex items-center gap-1 text-muted-foreground/80 underline underline-offset-2 hover:text-muted-foreground"
            >
              Shop our Amazon store <ArrowRight className="size-3.5" />
            </a>
            <span className="mt-1 block text-xs text-muted-foreground/70">
              Proceeds support this platform and the small businesses on it.
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
