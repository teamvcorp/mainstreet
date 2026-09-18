import { connectToDatabase } from "@/lib/db";
import { Business, type ShipMode } from "@/lib/models/Business";
import { Product } from "@/lib/models/Product";
import { User } from "@/lib/models/User";
import { getRates, type Destination, type RateQuote } from "@/lib/slpacknship";

/**
 * Shipping pricing + policy layer.
 *
 * Rates come from Storm Lake Pack & Ship at RETAIL and are charged to the buyer
 * unchanged — there is no markup any more (see docs/slpacknship.md). Two facts from
 * the partner contract shape this file:
 *
 *  - The ORIGIN IS FIXED to Storm Lake and is never sent, so a seller's ZIP has no
 *    effect on price. (The old EasyPost flow rated from `business.address.zip`.)
 *  - `mode` is priced at QUOTE time — pickup_pack retail includes Storm Lake's
 *    packing fee — so each shop's `shipMode` must be read before rating.
 *
 * And one rule: we FAIL CLOSED. A label can only be produced from a real stored
 * quote, so there is no estimate fallback; if we cannot price shipping we refuse to
 * create the order rather than guess and eat the difference.
 */

export interface CartLine {
  productId: string;
  businessId: string;
  variantId?: string;
  quantity: number;
}

/**
 * A buyer-facing shipping choice. Note what is ABSENT: the `quoteId`. The browser
 * never needs it (we re-quote authoritatively at order time), so we do not widen the
 * attack surface by sending it.
 */
export interface ShipOption {
  id: string; // "carrier:serviceCode" — stable key for selection
  label: string;
  carrier: string;
  service: string; // serviceCode — matched on, not the display name
  amountCents: number; // retail, exactly what the buyer pays
  deliveryDays?: number;
}

export interface BusinessShipping {
  businessId: string;
  businessName: string;
  shipsOnline: boolean;
  pickupAvailable: boolean;
  options: ShipOption[]; // best 2–3
  /** True when the shop ships but the partner API could not be reached just now. */
  ratesUnavailable?: boolean;
}

const DEFAULT_WEIGHT_OZ = 8;

function serviceLabel(carrier: string, serviceName: string): string {
  // The API returns lowercase carriers ("ups", "fedex", "usps") and a display name
  // that usually already includes the carrier ("UPS Ground"), so avoid "UPS UPS Ground".
  const name = serviceName?.trim() || carrier.toUpperCase();
  return name.toLowerCase().startsWith(carrier.toLowerCase())
    ? name
    : `${carrier.toUpperCase()} ${name}`;
}

/** Build the combined parcel for one business's items. */
async function buildParcel(lines: CartLine[]) {
  const products = await Product.find({
    _id: { $in: lines.map((l) => l.productId) },
  })
    .select("weightOz dimensions variants")
    .lean<
      {
        _id: { toString(): string };
        weightOz?: number;
        dimensions?: { lengthIn?: number; widthIn?: number; heightIn?: number };
        variants?: { _id: { toString(): string }; weightOz?: number }[];
      }[]
    >();
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  let weightOz = 0;
  let lengthIn = 0;
  let widthIn = 0;
  let heightIn = 0;
  for (const line of lines) {
    const p = byId.get(line.productId);
    // Prefer the selected variant's weight, falling back to the product's.
    const variant = line.variantId
      ? (p?.variants ?? []).find((v) => v._id.toString() === line.variantId)
      : undefined;
    const lineWeight = variant?.weightOz ?? p?.weightOz ?? DEFAULT_WEIGHT_OZ;
    weightOz += lineWeight * line.quantity;
    lengthIn = Math.max(lengthIn, p?.dimensions?.lengthIn ?? 0);
    widthIn = Math.max(widthIn, p?.dimensions?.widthIn ?? 0);
    heightIn = Math.max(heightIn, p?.dimensions?.heightIn ?? 0);
  }
  return {
    weightOz: Math.max(weightOz, DEFAULT_WEIGHT_OZ),
    lengthIn: lengthIn || 12,
    widthIn: widthIn || 9,
    heightIn: heightIn || 3,
  };
}

/** Cheapest + fastest, de-duplicated, capped at 3. */
function pickBest(rates: RateQuote[]): ShipOption[] {
  if (rates.length === 0) return [];
  const cheapest = [...rates].sort((a, b) => a.retailCents - b.retailCents)[0];
  const fastest = [...rates].sort(
    (a, b) => (a.estimatedDays ?? 99) - (b.estimatedDays ?? 99) || a.retailCents - b.retailCents,
  )[0];
  const chosen = [cheapest, fastest];
  // add a third distinct middle option if available
  const rest = rates.filter((r) => r !== cheapest && r !== fastest);
  if (rest.length) chosen.push(rest.sort((a, b) => a.retailCents - b.retailCents)[0]);

  const seen = new Set<string>();
  const out: ShipOption[] = [];
  for (const r of chosen) {
    const id = `${r.carrier}:${r.serviceCode}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: serviceLabel(r.carrier, r.serviceName),
      carrier: r.carrier,
      service: r.serviceCode,
      amountCents: r.retailCents,
      deliveryDays: r.estimatedDays,
    });
  }
  return out;
}

function toDestination(to: Destination): Destination {
  return {
    zip: to.zip,
    city: to.city,
    state: to.state,
    // Consumer orders are residential. Under-declaring does not save the buyer
    // anything (the quote is locked) — it lands a surcharge on Storm Lake.
    residential: true,
  };
}

/** Per-business shipping options for the checkout page. */
export async function computeCartShipping(
  lines: CartLine[],
  to: Destination,
): Promise<BusinessShipping[]> {
  await connectToDatabase();

  const byBiz = new Map<string, CartLine[]>();
  for (const l of lines) {
    if (!byBiz.has(l.businessId)) byBiz.set(l.businessId, []);
    byBiz.get(l.businessId)!.push(l);
  }

  const out: BusinessShipping[] = [];
  for (const [businessId, bizLines] of byBiz) {
    const biz = await Business.findById(businessId)
      .select("name shipsOnline acceptsLocalPickup shipMode")
      .lean<{
        name: string;
        shipsOnline?: boolean;
        acceptsLocalPickup?: boolean;
        shipMode?: ShipMode;
      }>();
    if (!biz) continue;

    let options: ShipOption[] = [];
    let ratesUnavailable = false;

    if (biz.shipsOnline) {
      try {
        const parcel = await buildParcel(bizLines);
        const quoted = await getRates(toDestination(to), parcel, biz.shipMode ?? "pickup_pack");
        options = pickBest(quoted.rates);
        // Reachable but empty (e.g. nothing serves that ZIP) is still "unavailable"
        // to the buyer — say so rather than silently implying pickup-only.
        ratesUnavailable = options.length === 0;
      } catch (err) {
        // One shop failing must not break the whole cart's rates, but we do NOT
        // fall back to an estimate: an invented rate has no quoteId and could
        // never be turned into a label.
        console.error(`computeCartShipping: rates failed for business ${businessId} —`, err);
        ratesUnavailable = true;
      }
    }

    out.push({
      businessId,
      businessName: biz.name,
      shipsOnline: !!biz.shipsOnline,
      pickupAvailable: !!biz.acceptsLocalPickup,
      options,
      ...(ratesUnavailable ? { ratesUnavailable: true } : {}),
    });
  }
  return out;
}

export interface ResolvedShipping {
  consumerCents: number;
  /**
   * Retail is all the partner ever tells us (contract §8), so this equals
   * `consumerCents` and `platformFeeCents` works out to 0. Kept because the Order
   * schema and the reconcile math still reference it — the shipping margin now
   * belongs to Storm Lake, not MainStreet.
   */
  carrierCents: number;
  carrier?: string;
  service?: string;
  /** Single-use, ~30 min TTL. Persisted so the label buys the rate we charged for. */
  quoteId?: string;
  quoteExpiresAt?: Date;
  shipMode?: ShipMode;
}

/**
 * Authoritatively resolve a buyer's chosen shipping for one business at order time.
 *
 * Re-quotes server-side (never trusts client amounts) and returns the retail price
 * plus the `quoteId` the label must later be bought against. Throws rather than ever
 * returning a silent zero — a "ship" order with no shipping charged is a direct loss
 * now that no markup cushions it.
 */
export async function resolveShippingChoice(
  businessId: string,
  lines: CartLine[],
  to: Destination,
  choice: { mode: "ship" | "pickup"; carrier?: string; service?: string },
): Promise<ResolvedShipping> {
  await connectToDatabase();
  const biz = await Business.findById(businessId)
    .select("shipsOnline acceptsLocalPickup shipMode")
    .lean<{ shipsOnline?: boolean; acceptsLocalPickup?: boolean; shipMode?: ShipMode }>();
  if (!biz) throw new Error("NOT_FOUND");

  if (choice.mode === "pickup") {
    // Previously accepted unconditionally, so a shop offering neither shipping nor
    // pickup still produced free pickup orders.
    if (!biz.acceptsLocalPickup) throw new Error("PICKUP_NOT_OFFERED");
    return { consumerCents: 0, carrierCents: 0 };
  }

  if (!biz.shipsOnline) throw new Error("SHIPPING_NOT_OFFERED");

  const shipMode = biz.shipMode ?? "pickup_pack";
  const parcel = await buildParcel(lines);

  let quoted;
  try {
    quoted = await getRates(toDestination(to), parcel, shipMode);
  } catch (err) {
    console.error(`resolveShippingChoice: rates failed for business ${businessId} —`, err);
    throw new Error("SHIPPING_UNAVAILABLE");
  }

  // Match the buyer's pick exactly. The old code substituted the cheapest rate when
  // the chosen service vanished, which silently changed both price and service; with
  // a real label to buy, failing is the correct behavior.
  const match = quoted.rates.find(
    (r) => r.carrier === choice.carrier && r.serviceCode === choice.service,
  );
  if (!match) throw new Error("SHIP_OPTION_UNAVAILABLE");

  return {
    consumerCents: match.retailCents,
    carrierCents: match.retailCents,
    carrier: match.carrier,
    service: match.serviceCode,
    quoteId: match.quoteId,
    quoteExpiresAt: quoted.quoteExpiresAt,
    shipMode,
  };
}

/**
 * Where Storm Lake should email a `self_ship` label.
 *
 * The business's own address wins; otherwise fall back to the owner's login email so
 * a shop that never filled in a contact address can still choose self_ship.
 */
export async function resolveLabelEmail(businessId: string): Promise<string | undefined> {
  await connectToDatabase();
  const biz = await Business.findById(businessId).select("email ownerId").lean<{
    email?: string;
    ownerId?: { toString(): string };
  }>();
  if (!biz) return undefined;
  if (biz.email) return biz.email;
  if (!biz.ownerId) return undefined;
  const owner = await User.findById(biz.ownerId).select("email").lean<{ email?: string }>();
  return owner?.email;
}
