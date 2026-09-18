# Architecture — how Supabase-spec maps onto Vercel + MongoDB

The spec PDF assumed Supabase (Postgres + RLS + Auth + Realtime + Storage + Edge
Functions). We build the same product on the Vercel/MongoDB stack. Mapping:

| Spec (Supabase) | Our implementation |
|---|---|
| Postgres + Prisma | MongoDB Atlas + Mongoose (`lib/models`) |
| Row-Level Security | App-layer authz: every route resolves session, checks role, scopes queries by owner; confidential fields stripped by `lib/dto` + schema `select:false` |
| Supabase Auth | Auth.js v5 (Credentials + Google), JWT sessions, roles in DB |
| Algolia | MongoDB Atlas Search (platform-only) |
| Supabase Storage | Vercel Blob (`@vercel/blob`) |
| Supabase Realtime | Server render + ~30s client poll (no realtime vendor) |
| Supabase Edge Functions (webhooks) | Next.js Route Handlers, signature-verified + idempotent via `WebhookEvent` ledger |

## Fulfillment flow
1. Checkout: **Storm Lake Pack & Ship Partner API** returns **retail** rates → charged to the
   buyer as-is (**no markup**). Origin is fixed to Storm Lake and never sent.
2. On payment success: order → `paid`; the webhook creates the real shipment. Each business
   chooses `shipMode`:
   - `self_ship` → the label is **emailed to the business**; tracking returns at once.
   - `pickup_pack` → Storm Lake **collects and packs**; we also email `SHIPIT_EMAIL`
     (`!! important`) because the API request carries no origin/business field.
3. `pickup_pack` tracking is backfilled by an hourly cron polling the partner's shipment
   history (the contract has no webhook).
4. Tracking + label surface on the seller's order detail (reprintable) and buyer tracking.
   `/admin/orders` stays for exceptions and manual overrides.

See `slpacknship.md`, `checkout.md`, `fulfillment.md`.

## Membership
- Seller: **$150/yr** (Stripe subscription on the platform account), base **10** items.
- Overage: **$5/mo per additional 50 items** (subscription add-on item) → raises `itemLimit`.
- Free "listed" tier remains (directory-only).

## Money & payments
- All amounts in **cents**. PaymentIntent on platform; transfer amount = subtotal only. We
  take **no cut** of product sales, and **none of shipping** either: rates are retail
  pass-through, so `platformFeeCents` is 0 and the spread belongs to Storm Lake.
  **Revenue is membership only.**
