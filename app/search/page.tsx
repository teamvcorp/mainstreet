import type { Metadata } from "next";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { searchAll, getAdjacentTowns } from "@/lib/search";
import { amazonSearchUrl, getAmazonTopMatch } from "@/lib/amazon";
import { BusinessCard } from "@/components/business/BusinessCard";
import { ProductCard } from "@/components/product/ProductCard";
import { EventListItem } from "@/components/events/EventListItem";
import { SearchEmptyState } from "@/components/search/SearchEmptyState";
import { cn } from "@/lib/utils";
import { T } from "@/components/i18n/T";
import { LocalizedSearchInput } from "@/components/i18n/LocalizedSearchInput";

// Search result pages shouldn't be indexed (thin/duplicative); the indexable
// SEO assets are town + store + product pages.
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

type Tab = "all" | "businesses" | "products" | "events";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; town?: string; category?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const town = sp.town;
  const category = sp.category;
  const tab = (["all", "businesses", "products", "events"].includes(sp.tab ?? "") ? sp.tab : "all") as Tab;

  if (!query) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <SearchIcon className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-3 font-serif text-2xl font-semibold">
          <T k="search.title" />
        </h1>
        <p className="mt-1 text-muted-foreground">
          <T k="search.subtitle" />
        </p>
        <form action="/search" method="get" className="mx-auto mt-6 flex max-w-md items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
          <SearchIcon className="ml-2 size-4 text-muted-foreground" />
          <LocalizedSearchInput placeholderKey="search.placeholder" autoFocus className="w-full bg-transparent px-1 focus:outline-none" />
        </form>
      </div>
    );
  }

  const { businesses, products, events } = await searchAll(query, { townSlug: town, category });
  const total = businesses.length + products.length + events.length;

  if (total === 0) {
    const [adjacent, amazonMatch] = await Promise.all([
      town ? getAdjacentTowns(town) : Promise.resolve([]),
      getAmazonTopMatch(query), // null until PA-API is configured
    ]);
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="mb-8 font-serif text-2xl font-semibold">
          <T k="search.resultsFor" /> “{query}”
        </h1>
        <SearchEmptyState
          query={query}
          townSlug={town}
          adjacentTowns={adjacent.map((t) => ({ name: t.name, state: t.state, slug: t.slug }))}
          amazonSearchUrl={amazonSearchUrl(query)}
          amazonMatch={amazonMatch}
        />
      </div>
    );
  }

  const buildTab = (t: Tab) => {
    const p = new URLSearchParams();
    p.set("q", query);
    if (town) p.set("town", town);
    if (category) p.set("category", category);
    if (t !== "all") p.set("tab", t);
    return `/search?${p.toString()}`;
  };

  const showBiz = tab === "all" || tab === "businesses";
  const showProd = tab === "all" || tab === "products";
  const showEvents = tab === "all" || tab === "events";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">
        <T k="search.resultsFor" /> “{query}”
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {total} <T k={total === 1 ? "search.match" : "search.matches"} />
      </p>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-2 border-b border-border pb-3">
        {(
          [
            ["all", "search.all", total],
            ["businesses", "search.shops", businesses.length],
            ["products", "search.products", products.length],
            ["events", "search.events", events.length],
          ] as [Tab, string, number][]
        ).map(([tabKey, labelKey, count]) => (
          <Link
            key={tabKey}
            href={buildTab(tabKey)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              tab === tabKey ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            <T k={labelKey} /> ({count})
          </Link>
        ))}
      </div>

      <div className="mt-8 space-y-10">
        {showBiz && businesses.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-xl font-semibold">
              <T k="search.localShops" />
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((b) => (
                <BusinessCard
                  key={b.id}
                  business={{ slug: b.slug, name: b.name, category: b.category, description: b.description, logoUrl: b.logoUrl, bannerUrl: b.bannerUrl }}
                />
              ))}
            </div>
          </section>
        )}

        {showProd && products.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-xl font-semibold">
              <T k="search.products" />
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={{ slug: p.slug, storeSlug: p.storeSlug, name: p.name, priceCents: p.priceCents, images: p.images }}
                />
              ))}
            </div>
          </section>
        )}

        {showEvents && events.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-xl font-semibold">
              <T k="search.events" />
            </h2>
            <div className="space-y-3">
              {events.map((e) => (
                <EventListItem
                  key={e.id}
                  event={{ id: e.id, title: e.title, category: e.category, startAt: e.startAt, locationName: e.town ? `${e.town.name}, ${e.town.state}` : undefined }}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
