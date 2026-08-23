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
  Customer Portal for manage/cancel), `status`, `sync`.
  - `subscribe`/`add-items` create an **embedded subscription**
    (`createEmbeddedSubscription` in `lib/billing.ts`): `subscriptions.create` with
    `payment_behavior:"default_incomplete"` + `save_default_payment_method:"on_subscription"`,
    expanding `latest_invoice.confirmation_secret`, and return `{ clientSecret }`. The
    browser confirms it with the **same Payment Element** as checkout — no redirect.
  - `subscriptions.create` needs a real Price (no inline `price_data` like Checkout),
    so `getOrCreatePriceId` **finds-or-creates** the Price by `lookup_key`
    (`ms_seller_membership_annual`, `ms_item_pack_monthly`) — created lazily the first
    time, then reused. No manual dashboard setup.
  - `portal` stays a **hosted redirect** (account management, not a card field).
- Webhook: handled inside the **existing** `/api/payments/webhook` (one endpoint,
  one signing secret). Branches: `customer.subscription.created/updated/deleted` → apply.
  (Embedded subs start `incomplete` then flip `active` on payment — `.created` +
  `.updated` both route to `applySubscription`, which is idempotent.)
- UI: `/seller/membership` — current plan + renewal, upgrade button, add item packs
  (both open an **inline Payment Element modal**), and "Manage billing" (portal). On a
  successful payment the page re-runs `/api/memberships/sync` (backstop) + reloads status.
  The seller sidebar and events gate use `isPaidActivePlan()` — upgrading unlocks event
  posting automatically.

## Enforcement
- Product create (`/api/products`) blocks at `business.itemLimit` (ITEM_LIMIT → 403).
- Event posting requires `isPaidActivePlan` (tier ≥ seller & not expired).

## Env / test
- Needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  (+ `stripe listen`). Prices are auto-created by `lookup_key` on first use.
- Register `customer.subscription.created/updated/deleted` in the prod webhook.
- Enable the Customer Portal once in Stripe (Settings → Billing → Customer portal).
- Test: `/seller/membership` → Upgrade → **embedded** card field → pay test card →
  webhook (`customer.subscription.updated`) + sync backstop flip tier to `seller`
  (events unlock); Add 50 items → itemLimit becomes 60; Manage billing → portal.
