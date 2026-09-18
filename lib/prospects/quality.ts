/**
 * The prospect quality filter. ONE implementation, four consumers:
 *   1. lib/prospects/ingest.ts          — caches the booleans at write time
 *   2. app/api/admin/prospects/[id]     — RECOMPUTES on every manual edit, so typing in an
 *                                          email can flip a record from excluded to included
 *   3. lib/prospects/queries.ts         — filters on the stored booleans (index-served);
 *                                          uses `reasons` for the "why excluded" tooltip
 *   4. lib/prospects/campaigns.ts       — `mailable` for postcards, `emailable` for email
 *
 * Because it is a pure function of the record, the stored booleans and a live recompute can
 * never disagree; if a schema change ever makes them drift, one script re-derives them all.
 *
 * THE STORAGE GATE vs THE CHANNEL GATES — this distinction is load-bearing:
 *
 *   ok        = (businessName && full address) || (validEmail && ownerName)
 *               ^ exactly the rule that was requested. Controls storage and display.
 *
 *   mailable  = businessName && street1 && city && state && zip5
 *   emailable = a valid email is present
 *
 * `ok` alone is NOT safe to drive a postcard run: its second branch passes a record that has an
 * email and an owner but NO ADDRESS AT ALL, and that record would print a blank label. Postcard
 * audiences must filter on `mailable`; email audiences on `emailable`.
 *
 * Pure module: no DB, no `next/*`.
 */

export type QualityReason =
  | "no_business_name"
  | "no_street"
  | "no_city"
  | "no_state"
  | "no_zip"
  | "no_email"
  | "invalid_email"
  | "no_owner_name";

/**
 * Deliberately permissive, and deliberately NOT the RFC 5322 grammar.
 * We only need to reject things that obviously cannot be delivered; Resend does the real
 * validation, and a too-clever regex rejects legitimate addresses.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim();
  return e.length > 0 && e.length <= 254 && EMAIL_RE.test(e);
}

export interface QualityInput {
  businessName?: string | null;
  ownerName?: string | null;
  email?: string | null;
  address?: {
    street1?: string | null;
    city?: string | null;
    state?: string | null;
    zip5?: string | null;
  } | null;
}

export interface QualityResult {
  /** Storage / display gate — the rule as requested. */
  ok: boolean;
  /** Channel gate: has a complete postal address. Drives postcard audiences and labels. */
  mailable: boolean;
  /** Channel gate: has a usable email. Drives email audiences. */
  emailable: boolean;
  hasOwner: boolean;
  reasons: QualityReason[];
}

export function evaluateProspectQuality(input: QualityInput): QualityResult {
  const reasons: QualityReason[] = [];

  const businessName = (input.businessName ?? "").trim();
  const ownerName = (input.ownerName ?? "").trim();
  const email = (input.email ?? "").trim();
  const a = input.address ?? {};
  const street1 = (a.street1 ?? "").trim();
  const city = (a.city ?? "").trim();
  const state = (a.state ?? "").trim();
  const zip5 = (a.zip5 ?? "").trim();

  if (!businessName) reasons.push("no_business_name");
  if (!street1) reasons.push("no_street");
  if (!city) reasons.push("no_city");
  if (!state) reasons.push("no_state");
  if (!zip5) reasons.push("no_zip");
  if (!email) reasons.push("no_email");
  else if (!isValidEmail(email)) reasons.push("invalid_email");
  if (!ownerName) reasons.push("no_owner_name");

  const hasFullAddress = !!(street1 && city && state && zip5);
  const emailable = isValidEmail(email);
  const hasOwner = ownerName.length > 0;

  const mailable = !!businessName && hasFullAddress;
  const ok = (!!businessName && hasFullAddress) || (emailable && hasOwner);

  return { ok, mailable, emailable, hasOwner, reasons };
}

/** Human-readable explanation for the admin UI's "why is this excluded?" tooltip. */
export const QUALITY_REASON_LABELS: Record<QualityReason, string> = {
  no_business_name: "No business name",
  no_street: "No street address",
  no_city: "No city",
  no_state: "No state",
  no_zip: "No ZIP code",
  no_email: "No email address",
  invalid_email: "Email address is not valid",
  no_owner_name: "No contact name",
};
