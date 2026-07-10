# Amazon Fallback / Affiliate Storefront (Addendum A)

## Why it's not a true embed
Amazon sends `X-Frame-Options: DENY` and the Associates agreement forbids framing —
so amazon.com **cannot** be iframed. Our "seamless" version keeps users in
MainStreet chrome and opens Amazon in a **new tab** (MainStreet stays open →
"back to local" is always one tab away).

## What ships today (curated links)
- **`/shop`** — branded, in-app page: query-specific "See X on Amazon" button,
  category tiles, full-storefront link, persistent "← Back to local" + platform
  search bar, and the required affiliate disclosure. `robots: noindex`.
- **Empty search exit** (`SearchEmptyState`, Layer 3): a QUIET "See '<query>' on
  Amazon" affiliate search link (Addendum A: never loud). Footer link → `/shop`.
- All outbound links use `AmazonLink` — logs an `amazon` search-exit (for
  `/admin/gaps`), `rel="sponsored"`, opens new tab, includes the associate tag.
- Links built by `lib/amazon.ts` `amazonSearchUrl(query)` using `AMAZON_ASSOCIATE_TAG`.

## Silent product + price (needs PA-API)
Showing a specific product's **title + price** requires the Product Advertising
API (PA-API 5.0) — which needs an approved Associates account (~3 qualifying
sales / 180 days). Wiring is ready:
- `lib/amazon.ts` `getAmazonTopMatch(query)` returns `null` until
  `AMAZON_PAAPI_ACCESS_KEY` / `AMAZON_PAAPI_SECRET_KEY` / `AMAZON_PARTNER_TAG` are set.
- `SearchEmptyState` already renders a **silent product card** (image, title,
  price) when a match is returned; otherwise the subtle search link.
- **Drop-in when approved:** implement the PA-API `SearchItems` call in
  `getAmazonTopMatch` (Resources: `ItemInfo.Title`, `Offers.Listings.Price`,
  `Images.Primary.Medium`), map the first result → `AmazonMatch`. Every caller
  lights up automatically; no UI changes needed.

## Compliance notes
- Affiliate disclosure shown on `/shop`. Keep it. Don't cloak links. `rel="sponsored"`.
- Never present Amazon results as if they were platform/local inventory.
