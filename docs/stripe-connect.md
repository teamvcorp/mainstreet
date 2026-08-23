# Stripe Connect — our setup

## Model: Express, hosted onboarding
Every seller gets a **Stripe Connect Express** account. Stripe hosts KYC/bank
collection — we never touch bank details. Client: `lib/stripe.ts` (`getStripe()`,
lazy, server-only; `isStripeConfigured()`).

## Routes (`/api/connect/*`)
- `GET /onboard` — creates the Express account if missing (stores `stripeAccountId`
  on the business), then redirects to a Stripe **account link** (`account_onboarding`).
  `refresh_url` → back to `/onboard`; `return_url` → `/callback`.
- `GET /callback` — retrieves the account, sets `business.stripeAccountActive =
  charges_enabled && details_submitted`, redirects to `/seller/connect?done=1`.
- `GET /account` — JSON status for the dashboard (connected/active/charges/payouts/configured).

## Payments model (built in Phase 4/6)
- Product sale: a **PaymentIntent on the platform account** (embedded Payment Element,
  no redirect) charges the full cart. The webhook then creates **separate transfers**
  per seller (`transfer_group` + `source_transaction = pi.latest_charge`), each =
  **subtotal only** (shipping stays on platform). Separate charges + transfers — NOT
  `transfer_data.destination` — so one cart can pay several shops. We take **no** cut of
  product sales.
- Membership: **$150/yr** subscription on the platform account; item packs
  **$5/mo per 50** as a separate monthly subscription. Both use the embedded Payment
  Element (`default_incomplete` → confirm client-side); Prices are auto-created by
  `lookup_key` (see `docs/memberships.md`).
- Payouts: handled by Stripe's **hosted Express dashboard** — no custom payout UI.
- **API version** is pinned to the SDK's bundled version (`Stripe.API_VERSION` in
  `lib/stripe.ts`) so runtime responses match the TypeScript types (e.g.
  `invoice.confirmation_secret`, which replaced the old `latest_invoice.payment_intent`).

## Env
`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_CONNECT_CLIENT_ID`. (Membership Price IDs are **auto-created by `lookup_key`** at
runtime — no `STRIPE_PRICE_*` env vars needed.) Without `STRIPE_SECRET_KEY`, connect routes
return 501 and the UI shows a "not configured" notice.

## Test (Stripe test mode)
1. Set `STRIPE_SECRET_KEY=sk_test_…` + `NEXT_PUBLIC_APP_URL`.
2. Seller dashboard → Payouts → "Connect with Stripe" → complete the test onboarding
   (use Stripe's test values) → returns to `/seller/connect?done=1` with "active".
