# Checkout, Shipping & Payments (Phase 4)

## Flow
1. **Cart** (`/cart`, Zustand+localStorage) → **Checkout** (`/checkout`, login-gated).
2. Buyer enters shipping address → **`POST /api/shipping/rates`** → `computeCartShipping`
   groups the cart by business, builds a combined parcel (weights/dims from the DB),
   calls **EasyPost** (`lib/easypost.ts`), applies the hidden markup, returns the
   **best 2–3 consumer options** per business (+ local pickup if enabled).
   Carrier cost is NEVER in this response.
3. Buyer picks ship option or pickup per shop → **"Continue to payment"** →
   **`POST /api/payments/create-intent`**:
   - `createPendingOrdersForCheckout` re-prices from the DB, checks inventory,
     **re-resolves shipping server-side** (authoritative consumer + carrier cents),
     and creates one **pending Order per business** (with confidential
     `carrierCostCents`/`platformFeeCents`).
   - Creates a **PaymentIntent** for the grand total on the PLATFORM account
     (`automatic_payment_methods` = card + Apple/Google Pay + Link, `transfer_group`,
     `setup_future_usage:"off_session"`, metadata `orderIds`) and returns
     `{ clientSecret, orderIds }`. **No redirect** — payment stays on-site.
   - If the buyer edits shipping after reaching payment, the client re-calls this with
     `abandonOrderIds` (the prior `orderIds`) → `discardPendingOrders` cleans them up
     (scoped to buyer + `pending`, so a paid order can never be deleted).
4. The **embedded Payment Element** (`components/checkout/PaymentForm.tsx`, wrapped in
   `<Elements>`) renders inline. `stripe.confirmPayment({ redirect:"if_required" })`
   confirms in place (3-D Secure shows an in-page modal; only redirect-style wallets use
   the `return_url` = `/orders/success`). On success the client clears the cart and routes
   to `/orders/success`.
5. **`POST /api/payments/webhook`** (`payment_intent.succeeded`, signature-verified,
   idempotent via `webhook_events`):
   - reads `orderIds` from the PI metadata, marks each sub-order **paid**, decrements inventory
   - **transfers each business's SUBTOTAL** to its connected account
     (`source_transaction` = `pi.latest_charge`; shipping revenue stays on the platform)
   - stores `stripeCustomerId` + `stripePaymentMethodId` (from the PI) for later shipping reconciliation
   - emails the buyer a confirmation, and emails **SL Pack & Ship** for ship orders
     (subject starts with **`!! important`**, body has receiver + package contents).

## Shipping = estimate at checkout, reconciled after packing
The shipping shown at checkout is an **estimate** (`lib/easypost.ts` `estimateRates`, tunable via
`SHIP_EST_BASE_CENTS` / `SHIP_EST_GROUND_PER_LB_CENTS` / `SHIP_EST_EXPEDITED_PER_LB_CENTS` × `SHIPPING_MARKUP`).
The buyer is charged the estimate now, and the **card is retained** (the PaymentIntent uses a real
Stripe `customer` + `setup_future_usage="off_session"`; the webhook stores
`stripeCustomerId` + `stripePaymentMethodId` on the order).

After SL Pack & Ship packs it, an admin enters the **final buyer shipping** on `/admin/orders`
(→ `POST /api/admin/orders/[id]/shipping`, `lib/reconcile.ts` `reconcileShipping`):
- **more** → off-session charge of the difference on the saved card; on decline/needs-auth it creates
  a hosted Checkout pay-link and emails the buyer (`shippingDueEmail`), flagging the order until paid
  (settled via the webhook's `shipping_adjustment` branch → `settleShippingAdjustment`).
- **less** → partial refund of the difference on the original PaymentIntent.
- **equal** → just marked reconciled.
Order fields: `shippingReconciled`, `shippingAdjustmentSessionId`. Buyer consent copy shown at
checkout (`checkout.estimateNote`).

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
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`,
  **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** (client-side, loads the Payment Element).
- Webhook events (prod dashboard): **`payment_intent.succeeded`** (orders),
  `customer.subscription.created/updated/deleted` (memberships),
  `checkout.session.completed` (shipping-adjustment pay-link only). `stripe listen`
  forwards them all automatically in dev.
- Apple Pay in production needs a **verified domain** in the Stripe dashboard
  (Settings → Payments → Payment methods → Apple Pay). Link + Google Pay need no setup.
- `EASYPOST_API_KEY` (optional in dev — a weight-based estimate is used when absent,
  flagged `estimated`). `SHIPPING_MARKUP` (default 1.85).
- `SHIPIT_EMAIL` (SL Pack & Ship handoff), `RESEND_API_KEY` (emails; no-op if unset).
- Sellers must finish Stripe Connect for transfers to land; otherwise funds stay on
  the platform and the order is still marked paid (reconcile manually).

## Local test
1. `STRIPE_SECRET_KEY=sk_test_…` in `.env.local`.
2. `stripe listen --forward-to localhost:3000/api/payments/webhook` → copy the
   `whsec_…` into `STRIPE_WEBHOOK_SECRET`, restart dev.
3. Add a product to cart → `/checkout` → address → get rates → **Continue to payment** →
   the **card field renders inline** (no redirect). Pay with test card
   `4242 4242 4242 4242` → stays on-site → land on `/orders/success` → order shows **paid**
   in `/orders`, confirmation + `!! important` emails fire (if `RESEND_API_KEY` set).
4. 3-D Secure card `4000 0027 6000 3184` → in-page auth modal, then success.
   Decline `4000 0000 0000 0002` → inline error, order stays pending, no finalize.
