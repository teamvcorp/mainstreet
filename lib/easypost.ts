import EasyPostClient from "@easypost/api";

/**
 * EasyPost rate shopping (server-only). Returns CARRIER rates in cents — this is
 * confidential and must never reach the client directly; lib/shipping.ts applies
 * the hidden markup and strips carrier cost before anything is sent to a buyer.
 *
 * Dev fallback: with no EASYPOST_API_KEY we synthesize a weight-based estimate so
 * checkout is testable end-to-end locally. Clearly flagged via `estimated: true`.
 */
export interface CarrierRate {
  carrier: string;
  service: string;
  carrierCents: number; // our cost (confidential)
  deliveryDays?: number;
  estimated?: boolean;
}

export interface Address {
  name?: string;
  street1?: string;
  city?: string;
  state?: string;
  zip: string;
}

export interface Parcel {
  weightOz: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
}

/** We only ship UPS and FedEx (no USPS). Applied to live rates + the estimate. */
export const SUPPORTED_CARRIERS = ["UPS", "FedEx"];

export function isEasyPostConfigured(): boolean {
  return !!process.env.EASYPOST_API_KEY;
}

let client: InstanceType<typeof EasyPostClient> | null | undefined;
function getClient(): InstanceType<typeof EasyPostClient> | null {
  if (client !== undefined) return client;
  const key = process.env.EASYPOST_API_KEY;
  client = key ? new EasyPostClient(key) : null;
  return client;
}

/** Read an integer-cents env var, falling back to a default when unset/invalid. */
function envCents(name: string, fallback: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function estimateRates(parcel: Parcel): CarrierRate[] {
  const lbs = Math.max(1, Math.ceil(parcel.weightOz / 16));
  // Tunable via env (defaults preserve prior behavior). Consumer price is then
  // this carrier estimate × SHIPPING_MARKUP (see lib/shipping.ts markupFactor).
  const base = envCents("SHIP_EST_BASE_CENTS", 500); // flat handling/base
  const ground = base + lbs * envCents("SHIP_EST_GROUND_PER_LB_CENTS", 90); // UPS Ground /lb
  const expedited = base + lbs * envCents("SHIP_EST_EXPEDITED_PER_LB_CENTS", 160); // FedEx 2Day /lb
  return [
    { carrier: "UPS", service: "Ground", carrierCents: ground, deliveryDays: 4, estimated: true },
    { carrier: "FedEx", service: "2Day", carrierCents: expedited, deliveryDays: 2, estimated: true },
  ];
}

const RATE_TIMEOUT_MS = 12000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("EASYPOST_TIMEOUT")), ms)),
  ]);
}

export async function getCarrierRates(
  fromZip: string,
  to: Address,
  parcel: Parcel,
): Promise<CarrierRate[]> {
  const ep = getClient();
  if (!ep) return estimateRates(parcel);

  // Basic input guard — without a destination zip EasyPost can't rate; estimate instead.
  if (!to.zip || !fromZip) return estimateRates(parcel);

  try {
    const shipment = await withTimeout(
      ep.Shipment.create({
        to_address: {
          name: to.name,
          street1: to.street1 || "",
          city: to.city,
          state: to.state,
          zip: to.zip,
          country: "US",
        },
        from_address: { zip: fromZip, country: "US" },
        parcel: {
          weight: Math.max(1, parcel.weightOz), // EasyPost weight is in ounces
          length: parcel.lengthIn,
          width: parcel.widthIn,
          height: parcel.heightIn,
        },
      }),
      RATE_TIMEOUT_MS,
    );

    const rates = (shipment.rates ?? [])
      .filter((r) => SUPPORTED_CARRIERS.includes(r.carrier ?? ""))
      .map((r) => ({
        carrier: r.carrier as string,
        service: r.service as string,
        carrierCents: Math.round(parseFloat(r.rate as string) * 100),
        deliveryDays: (r.delivery_days as number | null) ?? undefined,
      }))
      .filter((r) => Number.isFinite(r.carrierCents) && r.carrierCents > 0);

    return rates.length ? rates : estimateRates(parcel);
  } catch (err) {
    console.error("EasyPost rate lookup failed, using estimate:", err);
    return estimateRates(parcel);
  }
}
