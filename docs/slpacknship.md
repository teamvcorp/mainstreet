# Storm Lake Pack & Ship — Partner API integration

Replaces EasyPost as our rate source **and** becomes our label producer.

- **Contract:** `docs/vendor/slpacknship-PARTNER_API-v1.md` — a verbatim snapshot of
  contract v1 (source: `e:\slpack\PARTNER_API.md`). The partner versions their own copy;
  treat theirs as authoritative and re-snapshot when they bump it.
- **Client:** `lib/slpacknship.ts` — the only file that talks to the API.

## What this API is (and isn't)

It prices shipping at **retail** and produces real labels. It is *not* a rate aggregator
we mark up:

| | Old (EasyPost) | New (Storm Lake) |
|---|---|---|
| Buyer pays | `carrierCost × 1.85` | `retailUSD`, exactly |
| Carrier cost visible to us | yes | **never** (§8 "retail-only") |
| Our shipping margin | the spread | **none** — it's Storm Lake's |
| Origin | `business.address.zip` | **fixed to Storm Lake; never sent** |
| Labels | none (manual email handoff) | produced by the API |
| Carriers | UPS, FedEx | UPS, FedEx, **USPS** |

**MainStreet's revenue is now membership only.** `platformFeeCents` is 0 and
`carrierCostCents` is unknowable, so the `/admin` "Shipping margin" KPI became
"Shipping billed" (pass-through volume).

## Rules that shape the code

1. **No `quoteId` ⇒ no label.** A label is only ever produced from a stored quote (§5), so
   a synthesized rate is *unfulfillable*. We therefore **fail closed**: with no credentials
   the client throws `NOT_CONFIGURED` instead of estimating. This is the opposite of the old
   `lib/easypost.ts`, which silently degraded to a weight formula on any error — harmless when
   an 85% markup absorbed the difference, actively lossy now.
2. **Payment before label** (§3, §8). `/shipments` verifies the PaymentIntent succeeded and
   covers the quote, so it can only be called *after* `payment_intent.succeeded`.
3. **Quotes are single-use and expire in ~30 min** (§3). Persist the quoteId we charged
   against; a reused or stale one returns `409`.
4. **Origin is fixed to Storm Lake** (§4, §8) — we only ever send the destination. A seller's
   ZIP no longer affects rates at all.
5. **`mode` is priced at quote time** (§4). `pickup_pack` retail *includes* Storm Lake's
   packing fee, so the shop's `shipMode` must be known when rating, not just when labelling.

## Unit conversions — all at the client boundary

Our codebase is integer **cents** and weight in **ounces** throughout. The API speaks decimal
**USD** and decimal **pounds**. Nothing downstream should ever see the API's units.

| Ours | Theirs | Conversion |
|---|---|---|
| `weightOz` | `package.weightLbs` | `ceil(oz / 16 × 100) / 100`, floor `0.1` |
| cents | `retailUSD` | `Math.round(retailUSD × 100)` |

**Weight rounds up, deliberately.** Under-declaring weight doesn't save the buyer money — the
quote is locked, so the carrier surcharge lands on *Storm Lake*. Rounding up keeps the
partnership honest at a cost of a few cents.

## Modes ↔ `Business.shipMode`

| `shipMode` | API `mode` | Result |
|---|---|---|
| `self_ship` | `self_ship` | Label **emailed to `businessEmail`**; tracking returned immediately → order `shipped` |
| `pickup_pack` | `pickup_pack` | Storm Lake collects & packs. **No label, no tracking** (`status: "awaiting_pack"`) → order `processing` |

`self_ship` **requires** `Business.email` (falling back to the owner's `User.email`), or
`/shipments` fails validation.

`pickup_pack` returns no tracking and the contract has **no webhook**, so
`GET /api/partner/shipments` (§6) is the only way to learn the tracking number — polled by a
cron and matched on `orderRef` (our order id).

## Error handling

`lib/slpacknship.ts` maps HTTP status → a typed `SlpsError.code` so callers branch on meaning,
not numbers:

| Status | `code` | Caller should |
|---|---|---|
| 401 | `UNAUTHORIZED` | alert — credential rotated or wrong |
| 402 | `PAYMENT_NOT_VERIFIED` | shouldn't happen (we charge exact retail); alert |
| 409 | `QUOTE_EXPIRED` | re-quote; if the price moved, reconcile |
| 422 | `VALIDATION` | fix the field (`err.field` carries it) |
| 429 | `RATE_LIMITED` | retried automatically, honoring `Retry-After` |
| 500/502 | `CARRIER_UNAVAILABLE` | retried automatically; safe per §5 |

Retries are bounded (3 attempts, exponential backoff + jitter). `429`/`5xx` retry; `409` never
does — a `409` on `/shipments` means the *first* attempt already produced the label, which is
exactly the idempotency guarantee in §5, so retrying would be wrong.

## Environment

```
SLPS_PARTNER_ID=...          # X-Partner-Id      (server-only)
SLPS_PARTNER_SECRET=...      # X-Partner-Secret  (server-only)
SLPS_BASE_URL=https://www.slpacknship.com   # optional; defaults to production
SLPS_DEV_STUB=1              # local only — see below
```

Retired: `EASYPOST_API_KEY`, `SHIPPING_MARKUP`, `SHIP_EST_BASE_CENTS`,
`SHIP_EST_GROUND_PER_LB_CENTS`, `SHIP_EST_EXPEDITED_PER_LB_CENTS`.

**`SLPS_DEV_STUB` is an explicit opt-in, not a fallback.** Missing credentials must fail, so
production can never quietly serve fake rates. The stub is ignored when `NODE_ENV=production`
and its quote ids are prefixed `devstub_` so they're identifiable in logs and in Mongo.

## Open contract questions

Raised with Storm Lake; §8 says to ask rather than assume.

1. **`metadata.quoteId` with a multi-shop cart.** We create **one** PaymentIntent covering N
   sub-orders, so there are N quoteIds and the field is singular (§3). Comma list, a `quoteIds`
   array, or omit and rely on the amount check?
2. **Shared Stripe account.** §3 assumes we already share theirs. If our platform
   `STRIPE_SECRET_KEY` is a different account, every `/shipments` call returns `402`.
3. **Voiding a label** — no cancel endpoint is documented. What happens to a refunded
   `self_ship` order after the label is emailed?
4. **`pickup_pack` tracking latency** — how soon does `GET /shipments` show tracking, and is a
   webhook planned? (`WebhookEvent.provider` already accepts a non-Stripe provider.)
5. **`self_ship` return address** — the label ships on Storm Lake's carrier account with their
   origin, but is applied by a business elsewhere. Confirm intended.
6. **Staging base URL + sandbox credentials** (§1: "given separately").
7. **`pickup_pack` needs to know WHICH shop to collect from.** The `/shipments` request has
   no origin or business field (§4 fixes the origin to Storm Lake), and `businessEmail` is
   documented as `self_ship` only — so nothing in the API says which local business holds
   the item. We therefore still send the `SHIPIT_EMAIL` ops handoff for `pickup_pack`
   orders (and dropped it for `self_ship`). Should that move into the API instead?
8. **Expired quote where the re-quote is HIGHER.** `/shipments` requires a PaymentIntent
   covering the quote, but a top-up charge lands on a *separate* PaymentIntent the endpoint
   has no field for. Today `handleExpiredQuote` ships and refunds when the new price is
   lower or equal, and flags the order for an admin when it is higher — it cannot
   self-heal. Can `/shipments` accept a second `paymentIntentId`, or the sum of two?
