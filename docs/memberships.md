# Memberships & Billing (Phase 6)

## Plans
- **Listed** (free): directory listing only. Can't sell online or post events.
- **Seller — $150/year**: full storefront, shipping, and community events. Stripe
  subscription (annual) on the PLATFORM account.
- **Item packs — $5/month per +50 items**: raises the catalog cap above the base 10.
  A SEPARATE monthly subscription (Stripe requires one interval per subscription).
  `itemLimit = 10 + 50 × blocks`.

## Implementation
- `lib/billing.ts` — customer creation, constants, and `applySubscription(sub)`:
  the single idempotent updater that reads the subscription's `metadata.type`
  (`membership` | `item_pack`) + status and writes `membershipTier` /
  `membershipExpiresAt` / `extraItemBlocks` / `itemLimit`.
- Routes (`/api/memberships/*`): `subscribe`, `add-items`, `portal` (Stripe
  Customer Portal for manage/cancel), `status`. All use inline `price_data` — no
  pre-created Stripe Price IDs needed.
- Webhook: handled inside the **existing** `/api/payments/webhook` (one endpoint,
  one signing secret). Branches: `checkout.session.completed` with
  `mode === "subscription"` → apply; `customer.subscription.updated/deleted` → apply.
- UI: `/seller/membership` — current plan + renewal, upgrade button, add item packs,
  and "Manage billing" (portal). The seller sidebar and events gate use
  `isPaidActivePlan()` — upgrading unlocks event posting automatically.

## Enforcement
- Product create (`/api/products`) blocks at `business.itemLimit` (ITEM_LIMIT → 403).
- Event posting requires `isPaidActivePlan` (tier ≥ seller & not expired).

## Env / test
- Needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (+ `stripe listen`). No Price IDs.
- Enable the Customer Portal once in Stripe (Settings → Billing → Customer portal).
- Test: `/seller/membership` → Upgrade → pay test card → webhook flips tier to
  `seller` (events unlock); Add 50 items → itemLimit becomes 60; Manage billing → portal.
