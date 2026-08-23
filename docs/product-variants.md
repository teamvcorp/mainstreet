# Product options & variants

Author-defined variant matrix — a seller adds option axes (any names: Size, Flavor,
Color…) and every combination becomes its own sellable unit with its **own price, stock,
weight, and SKU**. Products with no options are unchanged (single price/stock).

## Data model (`lib/models/Product.ts`)
- `optionTypes: [{ name, values[] }]` — the axes (max 3, enforced in the schema).
- `variants: [{ _id, options:[{name,value}], priceCents, inventoryQty, trackInventory,
  weightOz?, sku?, isActive }]` — one per combination (max 100). Subdoc **`_id` is the
  stable identity** cart lines + order items reference.
- Base `priceCents/inventoryQty/weightOz` stay required and are authoritative ONLY when
  there are no variants; otherwise the variant fields win and the storefront shows "from $min".

## Validation (`schemas/product.ts`)
`createProductSchema` is a ZodEffects (`.superRefine`) that checks: variant option **names ==
the declared option types**, each value ∈ that type's values, and no duplicate combination.
`updateProductSchema` is a hand-declared all-optional twin with the same refine (can't
`.partial()` a ZodEffects).

## Edit merge (`app/api/products/[id]/route.ts`)
PATCH does NOT blind-assign `variants` (that regenerates every `_id`). It **merges by `id`**:
reuse the existing subdoc `_id` for kept combos, mint new ids for new rows, drop removed ones.
The seller form sends each existing variant's `id` back for this. `itemLimit` counts
**products**, not variants.

## Buy flow (the seams a variant threads through)
1. Storefront (`lib/storefront.ts` `productView`) exposes only **active** variants.
   `components/product/ProductBuyBox.tsx` renders one picker per axis, resolves the selected
   combination → variant, updates price/stock, and gates Add-to-cart.
2. Cart (`lib/cart.ts`) keys a line by **`productId:variantId`** (`lineKey`) so two variants of
   one product are separate lines; the line carries the variant's price/weight + a label.
3. Client → server sends `variantId` per line (`schemas/checkout.ts` `cartLineSchema`).
4. `lib/orders.ts` `createPendingOrdersForCheckout` **re-prices from the DB variant**
   (authoritative), rejects a missing/inactive variant (and rejects a bare productId when the
   product has active variants), snapshots `{ variantId, variantLabel, options }` onto the
   OrderItem, and `decrementInventoryForOrder` decrements that **variant subdoc** (positional
   `$elemMatch` + `variants.$.inventoryQty`).
5. Shipping (`lib/shipping.ts` `buildParcel`) uses the variant's `weightOz` (fallback product).
6. Emails (`lib/order-emails.ts`, `emails/OrderConfirmation.tsx`) print the variant label; buyer
   + seller order pages show it too.

## Known limitation
A matrix models mutually-exclusive axes (Size × Color). **Multi-select add-ons** ("pick any 3
of 8 toppings") aren't a matrix concept (8 = 256 combos) — model them as single-select axes
for now; a dedicated add-on/price-delta layer is a clean fast-follow.
