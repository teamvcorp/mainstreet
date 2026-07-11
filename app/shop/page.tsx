import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowLeft, ExternalLink } from "lucide-react";
import { amazonSearchUrl } from "@/lib/amazon";
import { AmazonLink } from "@/components/shop/AmazonLink";
import { T } from "@/components/i18n/T";
import { LocalizedSearchInput } from "@/components/i18n/LocalizedSearchInput";

// Thin affiliate page — keep it out of the index (and it's an exit surface).
export const metadata: Metadata = { title: "Shop Amazon", robots: { index: false, follow: false } };

const CATEGORIES = [
  { label: "Candles & home scents", q: "candles" },
  { label: "Kitchen & dining", q: "kitchen" },
  { label: "Tools & hardware", q: "tools hardware" },
  { label: "Gifts", q: "gifts" },
  { label: "Home décor", q: "home decor" },
  { label: "Outdoor & garden", q: "outdoor garden" },
  { label: "Toys & games", q: "toys games" },
  { label: "Books", q: "books" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const storefront = process.env.NEXT_PUBLIC_AMAZON_STOREFRONT_URL;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Back to local — always present */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/towns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> <T k="common.backToLocal" />
        </Link>
        <form action="/search" method="get" className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="size-4 text-muted-foreground" />
          <LocalizedSearchInput placeholderKey="shop.searchLocalFirst" className="w-44 bg-transparent text-sm focus:outline-none sm:w-56" />
        </form>
      </div>

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-semibold">
          <T k="shop.title" />
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          <T k="shop.body" />
        </p>
      </header>

      {/* Query-specific search (from an empty local search) */}
      {query && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            <T k="shop.lookingFor" />
          </p>
          <p className="font-serif text-xl font-semibold">“{query}”</p>
          <AmazonLink
            href={amazonSearchUrl(query)}
            query={query}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <T k="shop.seeOnAmazon" /> “{query}” <T k="shop.onAmazon" /> <ExternalLink className="size-4" />
          </AmazonLink>
        </div>
      )}

      {/* Category tiles */}
      <h2 className="mt-8 font-serif text-lg font-semibold">
        <T k="shop.browseCategories" />
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.map((c) => (
          <AmazonLink
            key={c.q}
            href={amazonSearchUrl(c.q)}
            query={c.q}
            className="rounded-xl border border-border bg-card p-4 text-sm font-medium transition-shadow hover:shadow-md"
          >
            {c.label}
          </AmazonLink>
        ))}
      </div>

      {storefront && (
        <div className="mt-8">
          <AmazonLink
            href={storefront}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <T k="shop.fullStorefront" /> <ExternalLink className="size-4" />
          </AmazonLink>
        </div>
      )}

      {/* Affiliate disclosure (required) */}
      <p className="mt-10 text-xs text-muted-foreground">
        <T k="shop.disclosure" />
      </p>
    </div>
  );
}
