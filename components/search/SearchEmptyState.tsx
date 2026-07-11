"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, ArrowRight } from "lucide-react";
import { SuggestBusinessForm } from "@/components/search/SuggestBusinessForm";
import { AmazonLink } from "@/components/shop/AmazonLink";
import { useT } from "@/components/i18n/I18nProvider";

interface AdjacentTown {
  name: string;
  state: string;
  slug: string;
}
interface AmazonMatch {
  title: string;
  priceText?: string;
  imageUrl?: string;
  url: string;
}

/**
 * The 3-layer exit shown when platform search finds nothing (Addendum A):
 *   1) Suggest a business (growth, not a dead end)
 *   2) Browse adjacent towns (widen discovery, still on-platform)
 *   3) Amazon fallback — quiet and last. If PA-API is live we silently show the
 *      top product + price; otherwise a subtle "see it on Amazon" search link.
 */
export function SearchEmptyState({
  query,
  townSlug,
  adjacentTowns,
  amazonSearchUrl,
  amazonMatch,
}: {
  query: string;
  townSlug?: string;
  adjacentTowns: AdjacentTown[];
  amazonSearchUrl?: string;
  amazonMatch?: AmazonMatch | null;
}) {
  const t = useT();
  useEffect(() => {
    void fetch("/api/search/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, townSlug, type: "bounced" }),
    });
  }, [query, townSlug]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Layer 1 — suggest a business */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-xl font-semibold">
          {t("search.noneTitle")} “{query}”.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("search.nominate")}</p>
        <div className="mt-4">
          <SuggestBusinessForm searchQuery={query} townSlug={townSlug} />
        </div>
      </section>

      {/* Layer 2 — adjacent towns */}
      {adjacentTowns.length > 0 && (
        <section>
          <h3 className="font-serif text-lg font-semibold">{t("search.nearby")}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {adjacentTowns.map((t) => (
              <Link
                key={t.slug}
                href={`/town/${t.slug}`}
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
      {(amazonMatch || amazonSearchUrl) && (
        <section className="border-t border-border pt-6">
          {amazonMatch ? (
            // Silent product card (PA-API): title + price, understated.
            <AmazonLink
              href={amazonMatch.url}
              query={query}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 no-underline transition-colors hover:bg-muted"
            >
              {amazonMatch.imageUrl && (
                <span className="relative block size-12 shrink-0 overflow-hidden rounded bg-background">
                  <Image src={amazonMatch.imageUrl} alt="" fill sizes="48px" className="object-contain" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{amazonMatch.title}</span>
                <span className="text-xs text-muted-foreground">
                  {t("search.available")}
                  {amazonMatch.priceText ? ` · ${amazonMatch.priceText}` : ""}
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </AmazonLink>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("search.amazonHint")}{" "}
              <AmazonLink
                href={amazonSearchUrl!}
                query={query}
                className="text-muted-foreground/80 underline underline-offset-2 hover:text-muted-foreground"
              >
                {t("search.seeOnAmazon")} “{query}” {t("search.onAmazon")}
              </AmazonLink>
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground/70">
            {t("search.proceeds")}{" "}
            <Link href={`/shop?q=${encodeURIComponent(query)}`} className="underline underline-offset-2">
              {t("search.moreOptions")}
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
