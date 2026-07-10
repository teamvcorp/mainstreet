# Search — platform-only

## Hard rule
All search queries hit ONLY our own MongoDB collections (businesses, products,
events). Never the internet, Google, Yelp, or any external source. The only
external URL search ever surfaces is the Amazon affiliate storefront in the
empty-results exit (Addendum A). Enforced in `lib/search.ts` + `/api/search/*`.

## Current implementation
Case-insensitive regex matching across name/description/category/tags/story,
scoped by town/state/category/price. Works everywhere with no extra setup and
fully satisfies the platform-only requirement.

## Production optimization (optional, later)
Swap the regex `find()` calls in `lib/search.ts` for MongoDB **Atlas Search**
(`$search` aggregation) for typo-tolerance, relevance scoring, and speed at scale.
Callers/UI don't change — only the query builders inside `lib/search.ts`. Create
Atlas Search indexes on `businesses`, `products`, `events` (searchable: name,
description, category, tags, title) via the Atlas UI/API. `ALGOLIA_*` from the
original spec is intentionally unused (we stayed on the Mongo stack).

## Empty-results exit (3 layers) — Addendum A
1. **Suggest a business** — `SuggestBusinessForm` → `POST /api/suggestions`
   (no auth; creates a lead, emails admin, logs a `suggest` exit).
2. **Adjacent towns** — `getAdjacentTowns()` (geo, ±120mi); clicks log `adjacent_town`.
3. **Amazon fallback** — quiet last link to `NEXT_PUBLIC_AMAZON_STOREFRONT_URL`;
   clicks log `amazon`.
All exits recorded in `search_exits` for the `/admin/gaps` demand report (Phase 9).
`GET /api/search/empty-handler` and `POST /api/search/exit` handle logging.
