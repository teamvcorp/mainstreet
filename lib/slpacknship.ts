/**
 * Storm Lake Pack & Ship — Partner API v1 client (SERVER-ONLY).
 *
 * Contract: docs/vendor/slpacknship-PARTNER_API-v1.md
 * Integration decisions + gotchas: docs/slpacknship.md
 *
 * This is the ONLY file that talks to the partner API. Unit and money conversions
 * live here so nothing downstream ever deals in pounds or decimal dollars:
 * our codebase is integer CENTS and weight in OUNCES everywhere.
 *
 * Two rules this module enforces, both load-bearing:
 *
 *  1. FAIL CLOSED. A label can only be produced from a stored quote (contract §5),
 *     so an invented rate is unfulfillable. With no credentials we THROW rather
 *     than estimate. (The old lib/easypost.ts did the opposite — it silently fell
 *     back to a weight formula, which was harmless when a 1.85x markup absorbed
 *     the error and is a direct loss now that we charge retail at cost.)
 *
 *  2. The credential is server-only. Never import this from a client component;
 *     never log the headers.
 */

/** Retail quote for one carrier service. `quoteId` is single-use, ~30 min TTL. */
export interface RateQuote {
  quoteId: string;
  carrier: string; // "ups" | "fedex" | "usps" (lowercase, per contract)
  serviceName: string;
  serviceCode: string;
  /** What we charge the consumer, in integer cents. Retail — no markup is applied. */
  retailCents: number;
  deliveryDate?: string;
  estimatedDays?: number;
}

export interface RatesResult {
  rates: RateQuote[];
  /** Absolute expiry, derived from the response's quoteExpiresInSeconds. */
  quoteExpiresAt: Date;
}

/** How the parcel reaches the carrier. Priced at quote time — pickup_pack includes packing. */
export type ShipMode = "self_ship" | "pickup_pack";

export interface Destination {
  zip: string;
  city?: string;
  state?: string;
  /** Consumer orders are residential; under-declaring costs Storm Lake a surcharge. */
  residential?: boolean;
}

/** Our internal parcel units (ounces / inches). Converted at the boundary below. */
export interface Parcel {
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

export interface Recipient {
  name: string;
  phone: string;
  email: string;
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface ShipmentResult {
  id: string;
  /** "shipped" (self_ship) or "awaiting_pack" (pickup_pack). */
  status: string;
  carrier?: string;
  serviceName?: string;
  /** self_ship only — pickup_pack returns no tracking until the shop ships it. */
  trackingNumber?: string;
  labelEmailedTo?: string;
}

export interface ShipmentSummary {
  id: string;
  createdAt?: string;
  status: string;
  carrier?: string;
  serviceName?: string;
  trackingNumber?: string;
  retailCents?: number;
  mode?: ShipMode;
  /** Our order id, echoed back — how the tracking-backfill cron matches rows. */
  orderRef?: string;
}

export type SlpsErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "PAYMENT_NOT_VERIFIED"
  | "QUOTE_EXPIRED"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "CARRIER_UNAVAILABLE"
  | "SERVER_ERROR";

/** Typed failure so callers branch on meaning rather than on HTTP numbers. */
export class SlpsError extends Error {
  constructor(
    readonly code: SlpsErrorCode,
    readonly status: number,
    message: string,
    /** Set for 422 — which field the API rejected. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "SlpsError";
  }
}

const DEFAULT_BASE_URL = "https://www.slpacknship.com";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 4_000;
/** Marks quotes produced by the local stub so they are obvious in logs and Mongo. */
export const DEV_STUB_PREFIX = "devstub_";

export function isConfigured(): boolean {
  return !!(process.env.SLPS_PARTNER_ID && process.env.SLPS_PARTNER_SECRET);
}

/**
 * Local-only fake rates. An EXPLICIT opt-in, never a fallback for missing
 * credentials — otherwise production could quietly serve unfulfillable quotes.
 */
export function isDevStub(): boolean {
  return process.env.SLPS_DEV_STUB === "1" && process.env.NODE_ENV !== "production";
}

function baseUrl(): string {
  return (process.env.SLPS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** oz -> decimal pounds, rounded UP to 2dp with a 0.1 lb floor (contract needs > 0). */
export function ozToLbs(weightOz: number): number {
  const oz = Number.isFinite(weightOz) && weightOz > 0 ? weightOz : 1;
  return Math.max(0.1, Math.ceil((oz / 16) * 100) / 100);
}

/** Decimal USD -> integer cents. Throws rather than let a bad price reach a buyer. */
function usdToCents(retailUSD: unknown): number {
  const n = typeof retailUSD === "number" ? retailUSD : parseFloat(String(retailUSD));
  if (!Number.isFinite(n) || n <= 0) {
    throw new SlpsError("SERVER_ERROR", 502, `Partner API returned an unusable price: ${retailUSD}`);
  }
  return Math.round(n * 100);
}

/** Dimensions are required and must be > 0; keep a sane positive fallback. */
function positiveIn(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function statusToCode(status: number): SlpsErrorCode {
  switch (status) {
    case 401:
      return "UNAUTHORIZED";
    case 402:
      return "PAYMENT_NOT_VERIFIED";
    case 409:
      return "QUOTE_EXPIRED";
    case 422:
      return "VALIDATION";
    case 429:
      return "RATE_LIMITED";
    case 500:
    case 502:
    case 503:
    case 504:
      return "CARRIER_UNAVAILABLE";
    default:
      return "SERVER_ERROR";
  }
}

/** `Retry-After` is seconds or an HTTP date; clamp whatever we get. */
function retryAfterMs(header: string | null, attempt: number): number {
  const backoff = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  const jitter = Math.random() * 200;
  if (!header) return backoff + jitter;
  const seconds = parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_BACKOFF_MS) + jitter;
  }
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), MAX_BACKOFF_MS) + jitter;
  return backoff + jitter;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One authenticated JSON call, with bounded retries.
 *
 * Retries 429 and 5xx (contract §5: "safe to retry the SAME request; a label is
 * only produced once per quote"). Never retries 409 — on /shipments that means the
 * FIRST attempt already produced the label, which is the idempotency guarantee, so
 * a retry would be actively wrong.
 */
async function request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  if (!isConfigured()) {
    throw new SlpsError(
      "NOT_CONFIGURED",
      501,
      "Storm Lake Pack & Ship credentials are not set (SLPS_PARTNER_ID / SLPS_PARTNER_SECRET).",
    );
  }

  const url = `${baseUrl()}${path}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Partner-Id": process.env.SLPS_PARTNER_ID as string,
          "X-Partner-Secret": process.env.SLPS_PARTNER_SECRET as string,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        // Next 16 does not cache fetch by default; explicit so nobody has to check.
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      // Network error or timeout — retryable.
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryAfterMs(null, attempt));
        continue;
      }
      throw new SlpsError("CARRIER_UNAVAILABLE", 502, `Partner API unreachable: ${String(err)}`);
    }

    if (res.ok) return (await res.json()) as T;

    // Read the error body defensively — it may not be JSON.
    let error: string | undefined;
    let field: string | undefined;
    try {
      const parsed = (await res.json()) as { error?: string; field?: string };
      error = parsed?.error;
      field = parsed?.field;
    } catch {
      /* non-JSON body; fall through to a generic message */
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      await sleep(retryAfterMs(res.headers.get("retry-after"), attempt));
      continue;
    }

    throw new SlpsError(
      statusToCode(res.status),
      res.status,
      error ?? `Partner API ${method} ${path} failed with ${res.status}`,
      field,
    );
  }

  throw new SlpsError(
    "CARRIER_UNAVAILABLE",
    502,
    `Partner API retries exhausted: ${String(lastError)}`,
  );
}

// ---------------------------------------------------------------------------
// Dev stub — local testing without credentials. Never active in production.
// ---------------------------------------------------------------------------

function stubRates(parcel: Parcel, mode: ShipMode): RatesResult {
  const lbs = ozToLbs(parcel.weightOz);
  const pack = mode === "pickup_pack" ? 450 : 0; // stand-in for the packing fee
  const seq = Date.now().toString(36);
  return {
    quoteExpiresAt: new Date(Date.now() + 1800 * 1000),
    rates: [
      {
        quoteId: `${DEV_STUB_PREFIX}ground_${seq}`,
        carrier: "ups",
        serviceName: "UPS Ground",
        serviceCode: "03",
        retailCents: Math.round(900 + lbs * 145) + pack,
        estimatedDays: 3,
      },
      {
        quoteId: `${DEV_STUB_PREFIX}2day_${seq}`,
        carrier: "fedex",
        serviceName: "FedEx 2Day",
        serviceCode: "FEDEX_2_DAY",
        retailCents: Math.round(1600 + lbs * 260) + pack,
        estimatedDays: 2,
      },
      {
        quoteId: `${DEV_STUB_PREFIX}priority_${seq}`,
        carrier: "usps",
        serviceName: "USPS Priority Mail",
        serviceCode: "Priority",
        retailCents: Math.round(800 + lbs * 120) + pack,
        estimatedDays: 3,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Quote one parcel. The ORIGIN IS NOT SENT — the contract fixes it to Storm Lake
 * (§4), so a seller's ZIP has no effect on price.
 */
export async function getRates(
  destination: Destination,
  parcel: Parcel,
  mode: ShipMode,
): Promise<RatesResult> {
  if (isDevStub()) return stubRates(parcel, mode);

  const payload = {
    destination: {
      zip: destination.zip,
      city: destination.city,
      state: destination.state,
      country: "US",
      residential: destination.residential ?? true,
    },
    package: {
      weightLbs: ozToLbs(parcel.weightOz),
      lengthIn: positiveIn(parcel.lengthIn, 12),
      widthIn: positiveIn(parcel.widthIn, 9),
      heightIn: positiveIn(parcel.heightIn, 3),
    },
    mode,
  };

  const data = await request<{
    quoteExpiresInSeconds?: number;
    rates?: {
      quoteId: string;
      carrier: string;
      serviceName: string;
      serviceCode: string;
      retailUSD: number;
      deliveryDate?: string;
      estimatedDays?: number;
    }[];
  }>("/api/partner/rates", "POST", payload);

  const ttl = Number.isFinite(data.quoteExpiresInSeconds)
    ? (data.quoteExpiresInSeconds as number)
    : 1800;

  return {
    quoteExpiresAt: new Date(Date.now() + ttl * 1000),
    rates: (data.rates ?? []).map((r) => ({
      quoteId: r.quoteId,
      carrier: r.carrier,
      serviceName: r.serviceName,
      serviceCode: r.serviceCode,
      retailCents: usdToCents(r.retailUSD),
      deliveryDate: r.deliveryDate,
      estimatedDays: r.estimatedDays,
    })),
  };
}

/**
 * Create the shipment for a PAID quote. Only callable after the PaymentIntent has
 * succeeded — the API verifies it covers the quote and returns 402 otherwise (§5).
 *
 * `mode` must match the mode the quote was rated with, and `recipient.zip` must
 * equal the quoted ZIP, or the API rejects it.
 */
export async function createShipment(input: {
  quoteId: string;
  paymentIntentId: string;
  mode: ShipMode;
  businessEmail?: string;
  orderRef?: string;
  recipient: Recipient;
}): Promise<ShipmentResult> {
  const isStubQuote = input.quoteId.startsWith(DEV_STUB_PREFIX);

  if (isDevStub() && isStubQuote) {
    const id = `${DEV_STUB_PREFIX}shp_${Date.now().toString(36)}`;
    return input.mode === "self_ship"
      ? {
          id,
          status: "shipped",
          carrier: "ups",
          serviceName: "UPS Ground",
          trackingNumber: `1ZDEVSTUB${Date.now().toString().slice(-9)}`,
          labelEmailedTo: input.businessEmail,
        }
      : { id, status: "awaiting_pack" };
  }

  // A stub quote can never buy a real label.
  if (isStubQuote) {
    throw new SlpsError("VALIDATION", 422, "Refusing to ship against a dev-stub quote.", "quoteId");
  }
  if (input.mode === "self_ship" && !input.businessEmail) {
    throw new SlpsError(
      "VALIDATION",
      422,
      "self_ship needs a business email to send the label to.",
      "businessEmail",
    );
  }

  const data = await request<{
    id: string;
    status: string;
    carrier?: string;
    serviceName?: string;
    trackingNumber?: string;
    labelEmailedTo?: string;
  }>("/api/partner/shipments", "POST", {
    quoteId: input.quoteId,
    paymentIntentId: input.paymentIntentId,
    mode: input.mode,
    businessEmail: input.businessEmail,
    orderRef: input.orderRef,
    recipient: { ...input.recipient, country: "US" },
  });

  return {
    id: data.id,
    status: data.status,
    carrier: data.carrier,
    serviceName: data.serviceName,
    trackingNumber: data.trackingNumber,
    labelEmailedTo: data.labelEmailedTo,
  };
}

/**
 * Our shipment history (retail figures only, scoped to our credential).
 *
 * This is the ONLY way to learn a pickup_pack tracking number: that mode returns
 * none at creation and the contract has no webhook, so a cron polls this and
 * matches rows on `orderRef`.
 */
export async function listShipments(limit = 50): Promise<ShipmentSummary[]> {
  if (isDevStub()) return [];

  const data = await request<{
    shipments?: {
      id: string;
      createdAt?: string;
      status: string;
      carrier?: string;
      serviceName?: string;
      trackingNumber?: string;
      retailUSD?: number;
      mode?: ShipMode;
      orderRef?: string;
    }[];
  }>(`/api/partner/shipments?limit=${Math.min(Math.max(limit, 1), 200)}`, "GET");

  return (data.shipments ?? []).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    status: s.status,
    carrier: s.carrier,
    serviceName: s.serviceName,
    trackingNumber: s.trackingNumber,
    // Tolerate a missing price here — history is informational, not a charge path.
    retailCents: typeof s.retailUSD === "number" ? Math.round(s.retailUSD * 100) : undefined,
    mode: s.mode,
    orderRef: s.orderRef,
  }));
}
