# Fulfillment

Labels are created **automatically** through the Storm Lake Pack & Ship Partner API
(`lib/fulfillment.ts` → `lib/slpacknship.ts`). This replaced the old manual flow, where an
admin typed a tracking number and uploaded a label PDF by hand.

Each business picks how its parcels reach the carrier — `Business.shipMode`, set on
`/seller/store`:

| `shipMode` | What happens on payment | Order status |
|---|---|---|
| **`self_ship`** | Storm Lake **emails the label** to the business email (falling back to the owner's login email). Tracking comes back immediately. | → `shipped` |
| **`pickup_pack`** | Storm Lake **collects and packs** it. No label, no tracking yet. Retail included their packing fee. | → `processing` |

`pickup_pack` is the default, so shops that existed before this change keep their old
behavior.

## Flow
1. `payment_intent.succeeded` → the webhook marks the order paid, transfers the seller's
   subtotal, then calls `createShipmentForOrder`. Shipment creation runs **after** the
   transfer and **never throws** — otherwise a partner outage would fail the webhook and
   Stripe would retry the transfers with it.
2. It buys against the order's stored **`shipQuoteId`** (single-use, ~30 min TTL) so the
   label matches the rate the buyer paid for. Results land on the Order
   (`shipmentId`, `trackingNumber`, `labelEmailedTo`) and in a **`Shipment`** record.
3. **`pickup_pack` tracking** arrives later. The contract has no webhook, so the hourly
   cron **`/api/cron/shipment-tracking`** polls `GET /api/partner/shipments`, matches rows
   on `orderRef` (our order id), and advances `processing → shipped`.
4. **Seller** sees it on `/seller/orders` → detail: buyer address, items, and mode-specific
   copy — "label emailed to …, print it and hand the parcel to the carrier" for
   `self_ship`, or "Storm Lake will collect and pack this" for `pickup_pack`. Pickup orders
   (the buyer collecting in person) still get **Mark picked up**.
5. **Buyer** sees status + tracking on `/orders/[id]`.
6. **Admin** `/admin/orders` remains for exceptions: it shows the ship mode, the
   `shipmentId`, and a loud **"Shipment not created — needs attention"** banner carrying the
   partner's reason when `shipmentFailedReason` is set. Manual tracking entry, label upload
   and Mark shipped/delivered are all still there as a fallback.

## Two order concepts that are easy to confuse
- **`Order.fulfillmentType`** (`ship` | `pickup`) — whether the **buyer** collects in person.
- **`Business.shipMode`** (`self_ship` | `pickup_pack`) — for a *shipped* order, how the
  parcel gets to the carrier.

They are orthogonal. `shipMode` is snapshotted onto the Order at creation so a later
settings change cannot rewrite history.

## Security / confidentiality
- Storm Lake reports **retail only**, so there is no longer a hidden spread to protect:
  `platformFeeCents` is 0 and `carrierCostCents == shippingCents`. The `select:false`
  columns and admin-only DTO gating are retained (they cost nothing), but the admin
  "margin" figures are now pass-through, not profit.
- This is also what makes emailed labels safe — at a 1.85× markup, a label showing postage
  would have leaked the margin to the seller.
- All mutation routes stay role-gated; the seller pickup action verifies business ownership.

## Notes
- `Shipment` (previously dead scaffolding) is now the shipment ledger. Its
  `carrierRateCents`/`marginCents` fields were removed — unpopulatable.
- No **void/cancel** endpoint is documented, so a refunded `self_ship` order after the label
  is emailed has no programmatic undo (open question 3 in `docs/slpacknship.md`).
- Label *upload* still needs a working Vercel Blob store; pasting a label URL works without.
