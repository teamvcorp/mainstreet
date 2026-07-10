# Deployment & Launch Checklist (Phase 10)

## Hosting
- Vercel (Next.js 16, Turbopack). Push to `main` → auto-deploy. Domain:
  **mainstreet-shops.com** (301 `www` → apex).

## Required environment variables (Vercel → Project → Settings → Env)
Set for Production (+ Preview/Development as needed). See `.env.example` for the full list.
- **Core**: `MONGODB_URI`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL=https://mainstreet-shops.com`
- **Auth (optional)**: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- **Stripe**: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Shipping**: `EASYPOST_API_KEY` (optional; estimate fallback), `SHIPPING_MARKUP=1.85`, `SHIPIT_EMAIL=shipit@slpacknship.com`
- **Storage**: `BLOB_READ_WRITE_TOKEN` — **create a Vercel Blob store and connect it** (Storage tab), else uploads 503
- **Email**: `RESEND_API_KEY`, `EMAIL_FROM=MainStreet <hello@fyht4.com>` (must be the **fyht4.com** verified domain)
- **Cron**: `CRON_SECRET` (any random string)
- **Maps**: `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
- **Amazon**: `AMAZON_ASSOCIATE_TAG`, `NEXT_PUBLIC_AMAZON_STOREFRONT_URL` (PA-API keys later)

> Any env change requires a **redeploy** to take effect.

## Webhooks (register in provider dashboards → point at prod)
- **Stripe**: add endpoint `https://mainstreet-shops.com/api/payments/webhook`;
  copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Subscribe to at least:
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`. (Membership page also self-syncs as a backstop.)
- Enable the Stripe **Customer Portal** (Settings → Billing → Customer portal).
- **EasyPost**: only used for rate quotes; no webhook required for the manual
  SL Pack & Ship flow.

## Cron
- `vercel.json` schedules `/api/cron/weekly-digest` Mondays 12:00 UTC (~7am CT).
  Vercel passes `Authorization: Bearer $CRON_SECRET` automatically.

## Data
- Towns auto-create from business addresses. Optionally seed:
  `node --env-file=.env.local scripts/seed-towns.mjs`.
- Grant yourself admin: `node --env-file=.env.local scripts/grant-role.mjs you@… --admin`.

## Pre-launch smoke test (Stripe test mode first)
1. Sign up → `/onboard/start` (town auto-creates) → `/seller/store` (upload logo — Blob) → add a product.
2. `/seller/membership` → upgrade $150 → tier flips to **seller**; add an item pack.
3. Shop as a buyer → cart → `/checkout` → pay (test card `4242…`) → `/orders/success`.
4. Confirm webhook: order **paid**, seller transfer created, buyer + `!! important` emails sent.
5. Admin `/admin/orders` → attach tracking + label → buyer sees tracking, gets shipped email.
6. Search a missing item → 3-layer exit + quiet Amazon link; nominate a business → `/admin/suggestions`.
7. `/admin` dashboard shows revenue + shipping margin.

## Security posture (audited)
- No `carrierCostCents` / `marginCents` / `platformFeeCents` in any client-facing
  response (DTO whitelists + schema `select:false`; admin-only views verified).
- Only non-secret `NEXT_PUBLIC_*` (app URL, Amazon storefront URL). All keys server-only.
- Webhooks signature-verified + idempotent (`webhook_events`). Zod on all inputs.
  Rate limits on auth/checkout/rates/uploads/suggestions. CSP + HSTS + security headers set.
- Known: 2 moderate `npm audit` advisories are in Next's bundled `postcss`
  (transitive); fixing means downgrading Next — accepted, no exposure for us.
  Revisit on the next Next.js patch.

## Follow-ups (post-launch)
- Tighten CSP to a nonce-based `script-src` (drop `'unsafe-inline'`).
- Add PA-API for live Amazon product/price (after Associates approval).
- Error monitoring (Sentry) + Vercel Analytics.
