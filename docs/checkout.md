# Checkout, Shipping & Payments

## Flow
1. **Cart** (`/cart`, Zustand+localStorage) → **Checkout** (`/checkout`, login-gated).
2. Buyer enters shipping address → **`POST /api/shipping/rates`** → `computeCartShipping`
   groups the cart by business, builds a combined parcel (weights/dims from the DB), reads
   each shop's **`shipMode`**, and calls **Storm Lake Pack & Ship** (`lib/slpacknship.ts`)
   for **retail** rates. Best 2–3 per business (+ local pickup if enabled).
   **No markup** — the buyer pays exactly what the API quotes. The response deliberately
   omits the `quoteId`s (the browser has no use for them).
3. Buyer picks ship option or pickup per shop → **"Continue to payment"** →
   **`POST /api/payments/create-intent`**:
   - `createPendingOrdersForCheckout` re-prices from the DB, checks inventory, and
     **re-quotes shipping server-side**, persisting the **`shipQuoteId`** (+ expiry +
     `shipMode`) on each order. That quote id is what the label is later bought against,
     so it must be the one we charged for.
   - Creates a **PaymentIntent** for the grand total on the PLATFORM account
     (`automatic_payment_methods`, `transfer_group`, `setup_future_usage:"off_session"`,
     metadata `orderIds`) and returns `{ clientSecret, orderIds, grandTotalCents }`.
     **No redirect** — payment stays on-site.
   - `grandTotalCents` is the authoritative figure: the client renders **that** on the pay
     button and warns if it differs from the estimate on screen (shipping was re-quoted).
   - If the buyer edits shipping after reaching payment, the client re-calls this with
     `abandonOrderIds` → `discardPendingOrders` cleans them up (scoped to buyer +
     `pending`, so a paid order can never be deleted).
4. The **embedded Payment Element** (`components/checkout/PaymentForm.tsx`) renders inline.
   `stripe.confirmPayment({ redirect:"if_required" })` confirms in place.
5. **`POST /api/payments/webhook`** (`payment_intent.succeeded`, signature-verified,
   idempotent via `webhook_events`):
   - marks each sub-order **paid**, decrements inventory
   - **transfers each business's SUBTOTAL** to its connected account
     (`source_transaction` = `pi.latest_charge`)
   - **creates the real shipment** (`lib/fulfillment.ts` `createShipmentForOrder`) — this
     can only happen now, because the partner refuses a label without a succeeded
     PaymentIntent covering the quote. Transfers run **first** and shipment creation never
     throws, so a partner outage cannot fail the webhook into a Stripe retry.
   - emails the buyer a confirmation, and for **`pickup_pack`** orders emails
     **SL Pack & Ship** (`!! important`) — that email is the only thing telling them which
     shop to collect from, since the API request carries no origin.

## Shipping = a locked retail quote (not an estimate)
The old EasyPost flow charged an **estimate** and trued it up afterwards. Storm Lake locks
the retail price at quote time, so what the buyer sees is what they pay.

- **No markup.** `SHIPPING_MARKUP` / `markupFactor()` are gone.
- **Fail closed.** There is no synthetic estimate fallback: a made-up rate has no `quoteId`
  and could never become a label, so if the API is unreachable we refuse to price shipping
  rather than guess. `SLPS_DEV_STUB=1` is the local-only escape hatch.
- **Reconcile is now an exception path.** `lib/reconcile.ts` only runs when a quote expires
  between payment and shipment creation (~30 min TTL), or when an admin corrects a figure.
  Every Stripe call there carries a deterministic idempotency key (`orderId` + from→to) and
  the local write is a compare-and-swap, so concurrent submits can't double-refund.
- If an expired quote re-quotes **higher**, we cannot self-heal (the original PaymentIntent
  wouldn't cover it and `/shipments` takes one PI) — the order is flagged
  `shipmentFailedReason` for an admin. See open question 8 in `docs/slpacknship.md`.

## Money model
- Buyer pays: product subtotal + **retail shipping, at cost**.
- Seller receives: product **subtotal only** (we take 0% of product sales).
- Platform keeps: **nothing on shipping.** The spread belongs to Storm Lake, so
  `platformFeeCents` is 0 and `carrierCostCents == shippingCents`. MainStreet's revenue is
  **membership only**. The `/admin` KPI is "Shipping billed" (pass-through volume), not
  "Shipping margin". Tax = 0 (no tax engine yet).

## Multi-seller
One PaymentIntent, `transfer_group`, then N transfers on the webhook, then N shipments —
one per business, each with its own `shipQuoteId`. `stripePaymentIntentId` on Order is
intentionally non-unique (shared across a cart's sub-orders).

⚠️ **Open:** the partner recommends `metadata.quoteId` on the PaymentIntent, but the field
is singular and a multi-shop cart has N quote ids. See open question 1 in
`docs/slpacknship.md`.

## Env / setup
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`,
  **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** (client-side, loads the Payment Element).
- **`SLPS_PARTNER_ID` + `SLPS_PARTNER_SECRET`** (+ optional `SLPS_BASE_URL`). Without them
  shipping fails closed; use `SLPS_DEV_STUB=1` locally. The partner API must be on the
  **same Stripe account** we use, or `/shipments` returns 402.
- Webhook events (prod dashboard): **`payment_intent.succeeded`** (orders),
  `customer.subscription.created/updated/deleted` (memberships),
  `checkout.session.completed` (shipping-adjustment pay-link only).
- `SHIPIT_EMAIL` (pickup_pack ops handoff), `RESEND_API_KEY` (emails; no-op if unset).
- Apple Pay in production needs a **verified domain** in the Stripe dashboard.
- Sellers must finish Stripe Connect for transfers to land; otherwise funds stay on the
  platform and the order is still marked paid (reconcile manually).
- Hourly cron `/api/cron/shipment-tracking` backfills tracking for `pickup_pack`.

## Local test
1. `STRIPE_SECRET_KEY=sk_test_…` and `SLPS_DEV_STUB=1` in `.env.local`.
2. `stripe listen --forward-to localhost:3000/api/payments/webhook` → copy the `whsec_…`
   into `STRIPE_WEBHOOK_SECRET`, restart dev.
3. Add a product to cart → `/checkout` → address → get rates → **Continue to payment** →
   card field renders inline. Pay `4242 4242 4242 4242` → stays on-site → `/orders/success`.
4. Set the shop to **self_ship** → the label email goes to the business, order → `shipped`
   with tracking. Set it to **pickup_pack** → order → `processing`, no tracking, and
   `SHIPIT_EMAIL` gets the `!! important` handoff; then hit
   `/api/cron/shipment-tracking` as an admin to exercise the backfill.
5. 3-D Secure `4000 0027 6000 3184` → in-page auth modal. Decline
   `4000 0000 0000 0002` → inline error, order stays pending, no finalize.
6. **Fail-closed check:** unset `SLPS_DEV_STUB` and leave credentials blank → checkout must
   refuse to price shipping and create no order.
