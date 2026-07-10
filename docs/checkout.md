# Checkout, Shipping & Payments (Phase 4)

## Flow
1. **Cart** (`/cart`, Zustand+localStorage) → **Checkout** (`/checkout`, login-gated).
2. Buyer enters shipping address → **`POST /api/shipping/rates`** → `computeCartShipping`
   groups the cart by business, builds a combined parcel (weights/dims from the DB),
   calls **EasyPost** (`lib/easypost.ts`), applies the hidden markup, returns the
   **best 2–3 consumer options** per business (+ local pickup if enabled).
   Carrier cost is NEVER in this response.
3. Buyer picks ship option or pickup per shop → **`POST /api/payments/create-intent`**:
   - `createPendingOrdersForCheckout` re-prices from the DB, checks inventory,
     **re-resolves shipping server-side** (authoritative consumer + carrier cents),
     and creates one **pending Order per business** (with confidential
     `carrierCostCents`/`platformFeeCents`).
   - Creates a **hosted Stripe Checkout Session** (line items = products + per-shop
     shipping), charged on the PLATFORM account with a `transfer_group`.
4. Buyer pays on Stripe's hosted page → returns to `/orders/success` (cart cleared).
5. **`POST /api/payments/webhook`** (`checkout.session.completed`, signature-verified,
   idempotent via `webhook_events`):
   - marks each sub-order **paid**, decrements inventory
   - **transfers each business's SUBTOTAL** to its connected account
     (`source_transaction` = the charge; shipping revenue stays on the platform)
   - emails the buyer a confirmation, and emails **SL Pack & Ship** for ship orders
     (subject starts with **`!! important`**, body has receiver + package contents).

## Money model
- Buyer pays: product subtotal + `carrier_rate × SHIPPING_MARKUP` (default 1.85).
- Seller receives: product **subtotal only** (we take 0% of product sales).
- Platform keeps: the shipping spread (`shippingCents − carrierCostCents`), stored as
  `platformFeeCents` (confidential). Tax = 0 for now (no tax engine yet).

## Multi-seller
One PaymentIntent, `transfer_group`, then N transfers on the webhook — supports a
cart spanning several shops. `stripePaymentIntentId` on Order is intentionally
non-unique (shared across a cart's sub-orders).

## Env / setup
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.
- `EASYPOST_API_KEY` (optional in dev — a weight-based estimate is used when absent,
  flagged `estimated`). `SHIPPING_MARKUP` (default 1.85).
- `SHIPIT_EMAIL` (SL Pack & Ship handoff), `RESEND_API_KEY` (emails; no-op if unset).
- Sellers must finish Stripe Connect for transfers to land; otherwise funds stay on
  the platform and the order is still marked paid (reconcile manually).

## Local test
1. `STRIPE_SECRET_KEY=sk_test_…` in `.env.local`.
2. `stripe listen --forward-to localhost:3000/api/payments/webhook` → copy the
   `whsec_…` into `STRIPE_WEBHOOK_SECRET`, restart dev.
3. Add a product to cart → `/checkout` → address → get rates → pay with test card
   `4242 4242 4242 4242` → land on `/orders/success` → order shows **paid** in `/orders`,
   confirmation + `!! important` emails fire (if `RESEND_API_KEY` set).
