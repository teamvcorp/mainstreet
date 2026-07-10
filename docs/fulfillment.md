# Fulfillment & Label Recall (Phase 5)

Fulfillment is a manual handoff to SL Pack & Ship (rates come from EasyPost at
checkout; the actual shipping happens in their system). This phase lets them log
tracking + labels back into MainStreet so sellers and buyers see them.

## Flow
1. Order is `paid` (ship type). Admin/SL Pack & Ship opens **`/admin/orders`**
   (Fulfillment) — filterable by To-ship / Shipped / Delivered / All. Margins are
   shown here (admin-only; sourced from the confidential `platformFeeCents`).
2. They enter the **tracking #** + carrier, optionally **upload a label** (PDF/image →
   `POST /api/admin/upload-label` → Vercel Blob) or paste a label URL, then
   **Mark shipped** → `PATCH /api/admin/orders/[id]` sets `status=shipped`,
   `shippedAt`, tracking/carrier/label, and emails the buyer a "shipped" notice.
3. **Mark delivered** advances to `delivered`.
4. **Seller** sees it on **`/seller/orders`** → order detail: buyer address, items,
   tracking, and **View / reprint label**. For **pickup** orders the seller taps
   **Mark picked up** (`PATCH /api/seller/orders/[id]`) → delivered.
5. **Buyer** sees status + tracking on **`/orders/[id]`**.

## Security
- Confidential fields (`carrierCostCents`, margin) appear ONLY in the admin views
  (`lib/admin-orders.ts`, after an admin role check). Seller/buyer views go through
  `toOrderDTO` (+ schema `select:false`) — never exposed.
- All mutation routes are role-gated; seller pickup action verifies business ownership.

## Notes
- Label upload needs a working Vercel Blob store (see the Blob setup note in the
  README). Pasting a label URL works without Blob.
- A future EasyPost tracking webhook could auto-advance `delivered`; today it's a
  manual admin action, which matches the SL Pack & Ship process.
