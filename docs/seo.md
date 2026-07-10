# SEO & cross-linking

## Canonical domain
`https://mainstreet-shops.com` — single source of truth in `lib/seo.ts` (`SITE.url`,
from `NEXT_PUBLIC_APP_URL`). Used by `metadataBase`, sitemap, robots, JSON-LD, and
per-page `alternates.canonical`. Configure the host to 301 `www` → apex so equity isn't split.

## What's wired
- **`app/layout.tsx`** — `metadataBase`, title template, default OG/Twitter, and
  site-wide JSON-LD: `Organization` (as a `subOrganization` of VA Corp) + `WebSite`
  with a `SearchAction` (Sitelinks search box → `/search?q=`).
- **`app/sitemap.ts`** — statics (`/`, `/towns`, `/events`) + one URL per active town.
  Falls back gracefully if the DB is down.
- **`app/robots.ts`** — allow public; disallow `/api /seller /admin /account /checkout
  /onboard`; points to `/sitemap.xml`.
- **Per-page canonical** — home, `/towns`, `/events`, `/town/[slug]` (+ OG url).
- **Breadcrumbs** — visible (`components/layout/Breadcrumbs`) + `BreadcrumbList`
  JSON-LD on `/towns`, `/events`, `/town/[slug]`.
- **Structured data** — `CollectionPage`/`City` on town pages; `Event` nodes on
  town + events pages. Builders for `LocalBusiness` and `Product` are ready in
  `lib/seo.ts` for Phase 3.

## VA Corp ecosystem backlinks (SEO-BACKLINKS.md)
`components/layout/SiteFooter.tsx` renders a dofollow hub link to
`https://www.thevacorp.com` + a "Sister programs" nav cross-linking all six
programs (`SISTER_PROGRAMS` in `lib/seo.ts`). Organization JSON-LD lists VA Corp as
`parentOrganization` and the network in `sameAs`. Descriptive anchors, absolute
https, no `nofollow`.

## Phase 3 storefronts — SEO checklist (do when building /store/[slug])
1. `generateMetadata` with `alternates.canonical: "/store/<slug>"` + OG image (logo/banner).
2. `generateStaticParams` from active business slugs (ISR).
3. Render `localBusinessJsonLd(...)` on the store page and `productJsonLd(...)` +
   `BreadcrumbList` (Home ▸ Town ▸ Store ▸ Product) on product pages.
4. Cross-link: store → its town, town → its stores (already), store → its products,
   product → store. Append `/store/*` and product URLs to `app/sitemap.ts`.
5. Keep the platform-only rule: no external links except the Amazon fallback.
