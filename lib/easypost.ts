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

function estimateRates(parcel: Parcel): CarrierRate[] {
  const lbs = Math.max(1, Math.ceil(parcel.weightOz / 16));
  const base = 500; // $5.00 handling/base
  const ground = base + lbs * 80; // +$0.80/lb
  const priority = base + lbs * 140; // +$1.40/lb
  return [
    { carrier: "USPS", service: "GroundAdvantage", carrierCents: ground, deliveryDays: 4, estimated: true },
    { carrier: "USPS", service: "Priority", carrierCents: priority, deliveryDays: 2, estimated: true },
  ];
}

export async function getCarrierRates(
  fromZip: string,
  to: Address,
  parcel: Parcel,
): Promise<CarrierRate[]> {
  const ep = getClient();
  if (!ep) return estimateRates(parcel);

  try {
    const shipment = await ep.Shipment.create({
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
    });

    const rates = (shipment.rates ?? [])
      .filter((r) => ["USPS", "UPS", "FedEx"].includes(r.carrier ?? ""))
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
