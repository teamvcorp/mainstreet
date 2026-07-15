import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { Product } from "@/lib/models/Product";
import { getCarrierRates, type Address } from "@/lib/easypost";

/** Consumer-rate multiplier over the carrier cost — the hidden spread. */
export function markupFactor(): number {
  const n = parseFloat(process.env.SHIPPING_MARKUP ?? "1.85");
  return Number.isFinite(n) && n > 0 ? n : 1.85;
}

export interface CartLine {
  productId: string;
  businessId: string;
  quantity: number;
}

export interface ShipOption {
  id: string; // "carrier:service" — stable key for selection
  label: string;
  carrier: string;
  service: string;
  amountCents: number; // consumer price (marked up) — safe to expose
  deliveryDays?: number;
}

export interface BusinessShipping {
  businessId: string;
  businessName: string;
  shipsOnline: boolean;
  pickupAvailable: boolean;
  options: ShipOption[]; // best 2–3
}

const DEFAULT_WEIGHT_OZ = 8;

function serviceLabel(carrier: string, service: string): string {
  const pretty = service.replace(/([a-z])([A-Z])/g, "$1 $2");
  return `${carrier} ${pretty}`;
}

/** Build the combined parcel + origin zip for one business's items. */
async function buildParcel(businessId: string, lines: CartLine[]) {
  const products = await Product.find({
    _id: { $in: lines.map((l) => l.productId) },
  })
    .select("weightOz dimensions")
    .lean<{ _id: { toString(): string }; weightOz?: number; dimensions?: { lengthIn?: number; widthIn?: number; heightIn?: number } }[]>();
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  let weightOz = 0;
  let lengthIn = 0;
  let widthIn = 0;
  let heightIn = 0;
  for (const line of lines) {
    const p = byId.get(line.productId);
    weightOz += (p?.weightOz ?? DEFAULT_WEIGHT_OZ) * line.quantity;
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
function pickBest(
  rates: { carrier: string; service: string; consumerCents: number; deliveryDays?: number }[],
): ShipOption[] {
  if (rates.length === 0) return [];
  const cheapest = [...rates].sort((a, b) => a.consumerCents - b.consumerCents)[0];
  const fastest = [...rates].sort(
    (a, b) => (a.deliveryDays ?? 99) - (b.deliveryDays ?? 99) || a.consumerCents - b.consumerCents,
  )[0];
  const chosen = [cheapest, fastest];
  // add a third distinct middle option if available
  const rest = rates.filter((r) => r !== cheapest && r !== fastest);
  if (rest.length) chosen.push(rest.sort((a, b) => a.consumerCents - b.consumerCents)[0]);

  const seen = new Set<string>();
  const out: ShipOption[] = [];
  for (const r of chosen) {
    const id = `${r.carrier}:${r.service}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: serviceLabel(r.carrier, r.service),
      carrier: r.carrier,
      service: r.service,
      amountCents: r.consumerCents,
      deliveryDays: r.deliveryDays,
    });
  }
  return out;
}

/** Per-business shipping options for the checkout page (consumer rates only). */
export async function computeCartShipping(
  lines: CartLine[],
  to: Address,
): Promise<BusinessShipping[]> {
  await connectToDatabase();
  const factor = markupFactor();

  const byBiz = new Map<string, CartLine[]>();
  for (const l of lines) {
    if (!byBiz.has(l.businessId)) byBiz.set(l.businessId, []);
    byBiz.get(l.businessId)!.push(l);
  }

  const out: BusinessShipping[] = [];
  for (const [businessId, bizLines] of byBiz) {
    try {
      const biz = await Business.findById(businessId)
        .select("name address shipsOnline acceptsLocalPickup")
        .lean<{ name: string; address?: { zip?: string }; shipsOnline?: boolean; acceptsLocalPickup?: boolean }>();
      if (!biz) continue;

      let options: ShipOption[] = [];
      const fromZip = biz.address?.zip;
      if (biz.shipsOnline && fromZip) {
        const parcel = await buildParcel(businessId, bizLines);
        const carrierRates = await getCarrierRates(fromZip, to, parcel);
        options = pickBest(
          carrierRates.map((r) => ({
            carrier: r.carrier,
            service: r.service,
            consumerCents: Math.round(r.carrierCents * factor),
            deliveryDays: r.deliveryDays,
          })),
        );
      }

      out.push({
        businessId,
        businessName: biz.name,
        shipsOnline: !!biz.shipsOnline,
        pickupAvailable: !!biz.acceptsLocalPickup,
        options,
      });
    } catch (err) {
      // One shop failing shouldn't break the whole cart's rates. Surface a
      // pickup-only fallback for it so checkout can still proceed.
      console.error(`computeCartShipping: business ${businessId} failed —`, err);
      out.push({
        businessId,
        businessName: "This shop",
        shipsOnline: false,
        pickupAvailable: true,
        options: [],
      });
    }
  }
  return out;
}

export interface ResolvedShipping {
  consumerCents: number;
  carrierCents: number;
  carrier?: string;
  service?: string;
}

/**
 * Authoritatively resolve a buyer's chosen shipping for one business at order
 * time. Recomputes rates server-side (never trusts client amounts) and returns
 * BOTH the consumer price and the confidential carrier cost.
 */
export async function resolveShippingChoice(
  businessId: string,
  lines: CartLine[],
  to: Address,
  choice: { mode: "ship" | "pickup"; carrier?: string; service?: string },
): Promise<ResolvedShipping> {
  if (choice.mode === "pickup") return { consumerCents: 0, carrierCents: 0 };

  await connectToDatabase();
  const biz = await Business.findById(businessId).select("address shipsOnline").lean<{
    address?: { zip?: string };
    shipsOnline?: boolean;
  }>();
  const fromZip = biz?.address?.zip;
  if (!biz?.shipsOnline || !fromZip) return { consumerCents: 0, carrierCents: 0 };

  const parcel = await buildParcel(businessId, lines);
  const rates = await getCarrierRates(fromZip, to, parcel);
  const factor = markupFactor();

  const match =
    rates.find((r) => r.carrier === choice.carrier && r.service === choice.service) ??
    [...rates].sort((a, b) => a.carrierCents - b.carrierCents)[0];
  if (!match) return { consumerCents: 0, carrierCents: 0 };

  return {
    consumerCents: Math.round(match.carrierCents * factor),
    carrierCents: match.carrierCents,
    carrier: match.carrier,
    service: match.service,
  };
}
