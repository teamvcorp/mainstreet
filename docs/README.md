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

## Manual test steps that need live credentials
Add to `.env.local` then run `npm run dev`:
- **DB:** `MONGODB_URI` → `npm run db:check`, then sign up at `/signup`, sign in at `/login`.
- **Roles:** `node --env-file=.env.local scripts/set-role.mjs you@email.com admin` → `/admin` now reachable.
- **Google:** `AUTH_GOOGLE_ID/SECRET` (redirect URI `http://localhost:3000/api/auth/callback/google`).
- **Password reset:** works without Resend (link is logged to the dev console); add `RESEND_API_KEY` to email for real.
