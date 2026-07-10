# MainStreet.shop — Engineering Notes

These notes are our single source of truth for third-party APIs, conventions, and
decisions, so we never re-research the same thing. Update the relevant file whenever you
learn something non-obvious. (Org policy: keep docs on-machine; take detailed notes.)

## Stack (Vercel + MongoDB)
- **Framework:** Next.js 16.2 (App Router, React 19, Turbopack, TypeScript strict)
- **DB:** MongoDB Atlas + Mongoose 9 — see `mongodb-atlas.md`
- **Auth:** Auth.js (NextAuth v5 beta) — see `authjs.md`
- **Search:** MongoDB Atlas Search (platform-only) — see `atlas-search.md`
- **Storage:** Vercel Blob — see `vercel-blob.md`
- **Payments:** Stripe Connect Express + subscriptions — see `stripe-connect.md`
- **Shipping:** EasyPost (rates only) + manual SL Pack & Ship email handoff — see `easypost.md`
- **Email:** Resend + React Email — see `resend.md`
- **Rate limiting:** Upstash Redis — see `upstash.md`
- **Geocoding/maps:** Google Maps — see `google-maps.md`

## Cross-cutting rules
- **Platform-only search.** `/api/search/*` only ever queries our Atlas index. The one
  external URL any search response may contain is the Amazon fallback.
- **Confidential fields** (`carrierCostCents`, `platformFeeCents`, `marginCents`) are
  `select:false` in schemas AND excluded by DTO mappers (`lib/dto`). Never sent to
  sellers/buyers. Admin-only via `toAdminOrderDTO`.
- **Secrets server-only.** Only `NEXT_PUBLIC_*` reaches the browser. See `.env.example`.
- **Money in cents** (integers) everywhere.

## Phase log
- **Phase 0** (foundation): deps, models, DTOs, theme, layout shell, config, docs. ✅ build-green, app boots, security headers live.
- **Phase 1** (auth): Auth.js v5 (Credentials + Google), JWT sessions + Mongoose upsert, `proxy.ts` route gating (verified: /account /seller /admin /checkout redirect to /login), signup + password reset (hashed single-use tokens), account page, AccountMenu island. ✅ build-green; live login/signup needs `MONGODB_URI`. See `authjs.md`.
- **Town Finder** (`/towns` + `/town/[slug]`): location-aware discovery — "Share my location" (browser geolocation) OR ZIP lookup, plus a radius slider (10–250 mi, presets) that expands the search area. `Town` model gained a GeoJSON `location` + `2dsphere` index; `getTowns()` uses `$geoNear` with business/event counts. Town page has hero, businesses grid, this-week events, share button, SEO metadata. Geo zip lookup via Google (`lib/geocode.ts`); `/api/geo/zip` returns friendly 501 without a key so "Share location" still works. ✅ build-green + UI verified. Seed data: `node --env-file=.env.local scripts/seed-towns.mjs` (12 real towns). Full nearby results need `MONGODB_URI`; ZIP lookup needs `GOOGLE_MAPS_API_KEY`.

- **Phase 2** (seller): onboarding (`/onboard/start` → creates shop, promotes to seller, refreshes JWT), seller dashboard with setup checklist, store profile editor (logo/banner via Blob, address geocoded), product CRUD with item-limit enforcement, image upload API, **Stripe Connect Express** hosted onboarding (`/api/connect/*`). ✅ build-green; gates verified (seller routes → /login, APIs → 401). Live flows need `MONGODB_URI` + `BLOB_READ_WRITE_TOKEN` + `STRIPE_SECRET_KEY`. See `stripe-connect.md`, `vercel-blob.md`.

- **Community Events**: paid-plan-gated posting, **Claude Haiku AI language screening** (local fallback), duplicate + same-time (±2h) → admin approval, contact pulled from business record, edit limited to name/details. Public `/events` (filters, date-grouped, RSVP), seller `/seller/events/*`, admin `/admin/events`. ✅ build-green; gates verified (APIs 401, pages 307, feed 200 live). Test helper: `scripts/grant-role.mjs`. See `events.md`, `ai-moderation.md`.

- **SEO & cross-linking**: canonical domain **mainstreet-shops.com** (`lib/seo.ts`), `sitemap.ts` (statics + towns), `robots.ts`, site-wide Organization (subOrg of VA Corp) + WebSite/SearchAction JSON-LD, per-page canonical + breadcrumbs + Event/CollectionPage structured data, and **VA Corp ecosystem backlinks** in the footer (hub + 6 sister programs, dofollow). Builders for LocalBusiness/Product ready for Phase 3 storefronts. ✅ build-green + output verified (robots/sitemap/JSON-LD/canonical/backlinks). See `seo.md`, `SEO-BACKLINKS.md`.

- **Phase 3** (storefronts + search): public `/store/[slug]` (SSG + LocalBusiness JSON-LD + breadcrumb + contact/hours/products) and `/store/[slug]/[product]` (gallery, Product JSON-LD, add-to-cart, related); **platform-only search** `/search` (tabs, filters) + `lib/search.ts` + `/api/search/*`; **3-layer empty exit** (suggest → adjacent towns → Amazon) with `search_exits` tracking; `/api/suggestions`. Functional **cart** (Zustand+localStorage, header badge, `/cart`) — checkout lands in Phase 4. New **Wordmark** branding in header/footer. ✅ build-green + verified (empty exit, storefront 404, search/suggest APIs, cart). See `atlas-search.md`.

- **Self-enroll + auto-towns**: onboarding is address-driven — a business enters city/state/ZIP (street optional), we geocode it and **auto-create/attach the town** (keyed by city+state, ZIPs accumulated on the town). No pre-curated town list. Admin moderation at **`/admin`** → **`/admin/businesses`** (verify / suspend / delete; deleting prunes products, events, and now-empty auto-towns) and `/admin/events`. New `Business.verified` + `Town.zips/autoCreated` fields. ✅ build-green + gates verified.

### ✅ You can onboard real businesses NOW (no more setup needed)
Your `.env.local` already has everything required (`MONGODB_URI`, `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `GOOGLE_MAPS_API_KEY`). Flow:
1. `npm run dev` (ensure `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local).
2. Business owner signs up at `/signup` → `/onboard/start` (enters address; town auto-creates) → `/seller/store` (logo/banner/story) → `/seller/products` (up to 10).
3. Live at `/store/<slug>`, appears in `/search`, `/towns`, and its town page.
4. To moderate: make yourself admin — `node --env-file=.env.local scripts/grant-role.mjs you@example.com --admin` — then visit `/admin/businesses`.
Optional keys unlock extras later: Stripe (checkout/payouts, Phase 4+), Resend (emails), Google OAuth (social login), Anthropic (AI event screening; local fallback works without it).

- **Phase 4** (checkout/shipping/payments): `/checkout` (address → per-shop shipping/pickup → pay), EasyPost rate shopping with hidden **1.85× markup** (carrier cost server-only; dev estimate fallback), pending orders (server-priced, inventory-checked), **hosted Stripe Checkout** (multi-seller `transfer_group`), idempotent signed **webhook** → paid + per-seller transfers (subtotal only) + buyer confirmation + **SL Pack & Ship `!! important` handoff email**. Functional `/cart` → `/orders` + `/orders/[id]`. ✅ build-green + gates verified. Needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (+ `stripe listen`) for the live paid flow; `EASYPOST_API_KEY` optional (estimate fallback). See `checkout.md`.

- **Phase 5** (fulfillment & label recall): admin/SL-Pack-&-Ship **`/admin/orders`** attaches tracking # + label (PDF/image upload or pasted URL) → marks shipped (emails buyer) / delivered, with admin-only margin display. Seller **`/seller/orders`** + detail (buyer address, items, tracking, **reprint label**, mark pickup fulfilled). Buyer tracking on `/orders/[id]`. Confidential margin/carrier cost never leaves admin views. ✅ build-green + gates verified. See `fulfillment.md`.
- **Vercel Blob fix**: stale-store errors now return a clear message (503) instead of a 500; label uploads (PDF) supported. To re-enable image/label uploads: create a Blob store in Vercel and `vercel env pull .env.local` (businesses onboard fine without images meanwhile).

- **Phase 6** (memberships & billing): **$150/yr** seller membership + **$5/mo per +50 items** packs via Stripe subscription Checkout (inline `price_data`, no Price IDs). `lib/billing.ts` `applySubscription()` (idempotent) drives tier/expiry/itemLimit; handled in the shared payments webhook (`checkout.session.completed` subscription + `customer.subscription.updated/deleted`). `/seller/membership` (upgrade, add packs, Stripe Customer Portal for manage/cancel). Upgrading auto-unlocks event posting. ✅ build-green + gates verified. See `memberships.md`.

- **Phase 8** (email & notifications): React Email templates (`emails/` — order confirmation, shipped, weekly digest) rendered via Resend; `sendEmail()` accepts a `react` element. **From must be @fyht4.com** (Resend-verified). Weekly **town digest** (`lib/digest.ts`) → `GET /api/cron/weekly-digest` (Bearer `CRON_SECRET` or admin) on a Vercel Cron (`vercel.json`, Mondays). Order/shipped emails wired into checkout + fulfillment. ✅ build-green + cron gate verified. See `email.md`.

- **Phase 9** (admin panel): `/admin` **revenue dashboard** (KPIs: revenue, shipping margin, GMV, orders, members, towns) + nav. `/admin/gaps` (unmet-demand report from `search_exits`), `/admin/suggestions` (outreach status), `/admin/towns` (add/edit tagline+hero, hide, delete — blocked if active shops), `/admin/users` (role changes + send password reset), `/admin/digest` (manual send). Plus earlier `/admin/businesses`, `/admin/orders`, `/admin/events`. `lib/admin-stats.ts` aggregations. ✅ build-green + gates verified. Confidential margins shown only in admin views.

- **Fixes (post-Phase-9)**:
  - **Membership tier sync**: paying $150 upgrades tier via the Stripe webhook, but that won't fire on localhost without `stripe listen` (or before the prod endpoint is registered). Added `POST /api/memberships/sync` (reconciles active subs from Stripe), called on `/seller/membership` load → tier reflects payment immediately regardless of webhooks. Prod: still register the webhook + `STRIPE_WEBHOOK_SECRET` for real-time + cancellations.
  - **Image "file too large"**: `lib/image-compress.ts` downscales (≤1600px, webp) in-browser before upload in `ImageUpload`, so large photos/logos/banners just work; 5 MB server check remains a backstop.
  - **Storefront logo**: page already prefers `logoUrl` (falls back to a Store icon only when none uploaded). With uploads fixed + a live Blob store, the uploaded logo now displays.

## Manual test steps that need live credentials
Add to `.env.local` then run `npm run dev`:
- **DB:** `MONGODB_URI` → `npm run db:check`, then sign up at `/signup`, sign in at `/login`.
- **Roles:** `node --env-file=.env.local scripts/set-role.mjs you@email.com admin` → `/admin` now reachable.
- **Google:** `AUTH_GOOGLE_ID/SECRET` (redirect URI `http://localhost:3000/api/auth/callback/google`).
- **Password reset:** works without Resend (link is logged to the dev console); add `RESEND_API_KEY` to email for real.
