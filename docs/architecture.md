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

## Fulfillment flow (confirmed with owner)
1. Checkout: EasyPost returns rates → apply `SHIPPING_MARKUP` (1.85, hidden) → show best 2–3.
2. On payment success: order → `paid`; email `SHIPIT_EMAIL` (shipit@slpacknship.com),
   subject `!! important`, with receiver name/address/phone + full package info.
3. SL Pack & Ship physically ships, then logs into an **admin** screen and attaches the
   **tracking number + label PDF** (Blob) to the order.
4. That surfaces on the seller's **order-history** page (reprintable) and the buyer's tracking.

## Membership
- Seller: **$150/yr** (Stripe subscription on the platform account), base **10** items.
- Overage: **$5/mo per additional 50 items** (subscription add-on item) → raises `itemLimit`.
- Free "listed" tier remains (directory-only).

## Money & payments
- All amounts in **cents**. PaymentIntent on platform; `transfer_data.destination` = seller;
  transfer amount = subtotal only (shipping revenue stays on platform). We take **no cut** of
  product sales — revenue is membership + shipping spread.
