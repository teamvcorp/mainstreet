/**
 * Central SEO configuration + JSON-LD builders.
 *
 * Canonical domain is mainstreet-shops.com. Everything that needs an absolute
 * URL (metadataBase, sitemap, structured data, OG tags) resolves through here so
 * there's a single source of truth and link equity isn't split across
 * www/non-www or .com/.shop variants.
 */
export const SITE = {
  name: "MainStreet",
  brand: "MainStreet.shop",
  url: (process.env.NEXT_PUBLIC_APP_URL ?? "https://mainstreet-shops.com").replace(/\/$/, ""),
  description:
    "America's hometown digital platform — discover local businesses, shop small, and keep up with community events across small-town America.",
} as const;

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

// --- VA Corp ecosystem (see SEO-BACKLINKS.md) ---------------------------------
export const VA_CORP = { name: "VA Corp", url: "https://www.thevacorp.com" } as const;

/** Sibling program sites we reciprocally link to (descriptive, dofollow). */
export const SISTER_PROGRAMS = [
  { name: "Edynsgate", url: "https://edynsgate.com", focus: "Housing" },
  { name: "Homeschool+", url: "https://homeschool-plus.com", focus: "Education" },
  { name: "RallyUp", url: "https://rallyup.us", focus: "Healthcare" },
  { name: "The Good Deed", url: "https://thegooddeed.net", focus: "Youth Leadership" },
  { name: "Spirit of Santa", url: "https://spiritofsanta.com", focus: "Positive Behavior" },
  { name: "Grantify", url: "https://www.getgrantify.com", focus: "Grants & Funding" },
] as const;

type Json = Record<string, unknown>;

/** Site-wide Organization node: MainStreet as a subOrganization of VA Corp. */
export function organizationJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    parentOrganization: { "@type": "NGO", name: VA_CORP.name, url: VA_CORP.url },
    sameAs: [VA_CORP.url, ...SISTER_PROGRAMS.map((p) => p.url)],
  };
}

/** WebSite node with a Sitelinks Search Box pointing at our platform-only search. */
export function websiteJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** Town page → CollectionPage about a Place. */
export function townJsonLd(town: {
  name: string;
  state: string;
  slug: string;
  tagline?: string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${town.name}, ${town.state}`,
    description: town.tagline ?? `Local businesses and events in ${town.name}, ${town.state}.`,
    url: absoluteUrl(`/town/${town.slug}`),
    about: { "@type": "City", name: town.name, address: { "@type": "PostalAddress", addressRegion: town.state, addressCountry: "US" } },
  };
}

/** Event node (used on town/events pages and, later, event detail). */
export function eventJsonLd(e: {
  title: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  locationName?: string;
  town?: { name: string; state: string };
  business?: { name: string } | null;
  imageUrl?: string;
  isFree?: boolean;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description: e.description,
    startDate: e.startAt,
    endDate: e.endAt,
    image: e.imageUrl ? [e.imageUrl] : undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: e.locationName ?? (e.town ? `${e.town.name}, ${e.town.state}` : undefined),
      address: e.town
        ? { "@type": "PostalAddress", addressLocality: e.town.name, addressRegion: e.town.state, addressCountry: "US" }
        : undefined,
    },
    organizer: e.business ? { "@type": "Organization", name: e.business.name } : undefined,
    isAccessibleForFree: e.isFree,
  };
}

/**
 * LocalBusiness node for Phase 3 storefront pages. Kept here so /store/[slug]
 * only has to import + render it.
 */
export function localBusinessJsonLd(b: {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  phone?: string;
  website?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  lat?: number;
  lng?: number;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    url: absoluteUrl(`/store/${b.slug}`),
    description: b.description,
    image: b.logoUrl ? [b.logoUrl] : undefined,
    telephone: b.phone,
    sameAs: b.website ? [b.website] : undefined,
    address: b.address
      ? {
          "@type": "PostalAddress",
          streetAddress: b.address.street,
          addressLocality: b.address.city,
          addressRegion: b.address.state,
          postalCode: b.address.zip,
          addressCountry: "US",
        }
      : undefined,
    geo:
      typeof b.lat === "number" && typeof b.lng === "number"
        ? { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng }
        : undefined,
  };
}

/** Product node for Phase 3 product pages. */
export function productJsonLd(p: {
  name: string;
  description?: string;
  images?: string[];
  priceCents: number;
  storeName?: string;
  url: string;
  inStock?: boolean;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.images,
    brand: p.storeName ? { "@type": "Brand", name: p.storeName } : undefined,
    offers: {
      "@type": "Offer",
      price: (p.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      url: absoluteUrl(p.url),
      availability: p.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };
}
