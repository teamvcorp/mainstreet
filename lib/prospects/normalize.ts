/**
 * Prospect normalization — pure string helpers. No DB, no `next/*` imports, so this
 * is safely importable from ingest, route handlers, queries, exports and the print page.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE:
 * every queryable string is stored TWICE — a `display` field (what a human reads) and a
 * normalized `key` field (what queries touch). Queries only ever hit the key field with an
 * EQUALITY predicate. There is no case-insensitive regex against a business name or city
 * anywhere in this feature. That is simultaneously the performance story (an index scan
 * instead of a collection scan) and half the regex-injection story.
 */

import { townSlug } from "@/lib/towns";
import { createHash } from "node:crypto";

/** Tokens that stay uppercase in display case — legal suffixes and initialisms. */
const KEEP_UPPER = new Set([
  "LLC", "L.L.C.", "LC", "L.C.", "PLC", "LP", "L.P.", "LLP", "PC", "P.C.", "PLLC",
  "INC", "CO", "CORP", "USA", "US", "II", "III", "IV", "DBA", "LTD", "PA", "MD", "DDS",
]);

/** Lowercased unless they lead the string. */
const PARTICLES = new Set(["of", "and", "the", "at", "on", "for", "in", "a", "an", "to", "by"]);

/**
 * "!MPACT LTD CO" -> "!mpact Ltd Co";  "O'BRIEN" -> "O'Brien".
 *
 * Source values are ALL CAPS, which looks like shouting in a UI and on a mailing label.
 * This is deliberately lossy and imperfect — acceptable because `source` + `sourceId` let us
 * re-derive the original from the state file at any time.
 */
export function toDisplayCase(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const bare = word.replace(/[^\w.&'-]/g, "");
      if (KEEP_UPPER.has(bare.toUpperCase())) return word.toUpperCase();
      const lower = word.toLowerCase();
      if (i > 0 && PARTICLES.has(lower)) return lower;
      // Re-capitalize after an apostrophe or hyphen: "o'brien" -> "O'Brien", "smith-jones" -> "Smith-Jones".
      return lower.replace(/(^|['\-])([a-z])/g, (_m, sep, ch) => sep + ch.toUpperCase());
    })
    .join(" ");
}

/** Lookup key for a name: lowercase, punctuation stripped, whitespace collapsed. */
export function normalizeKey(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trim + lowercase only.
 *
 * Deliberately NO plus-address stripping and NO dot-stripping: those are Gmail-consumer
 * conventions and are simply wrong for B2B mailboxes, where `sales+web@shop.com` and
 * `sales@shop.com` may be genuinely different inboxes.
 */
export function normalizeEmail(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

/** "51601" | "51601-1234" | "516011234" -> { zip5, zip4 }. Returns null if not 5+ digits. */
export function normalizeZip(input: string | null | undefined): { zip5: string; zip4?: string } | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length < 5) return null;
  const zip5 = digits.slice(0, 5);
  const zip4 = digits.length >= 9 ? digits.slice(5, 9) : undefined;
  return { zip5, zip4 };
}

/** 2-letter uppercase state, or "" when absent/invalid. */
export function normalizeState(input: string | null | undefined): string {
  const s = (input ?? "").trim().toUpperCase().slice(0, 2);
  return /^[A-Z]{2}$/.test(s) ? s : "";
}

/**
 * USPS-style street normalization: uppercase, punctuation stripped, suffixes and
 * directionals abbreviated, whitespace collapsed.
 *
 * WHY THIS IS MANDATORY, NOT COSMETIC: the source gives two addresses per business and they
 * are frequently the same building written two ways. From the real sample row —
 *   ra_address_1: "312 CARTER ST"   ho_address_1: "312 EAST CARTER STREET"
 * Without this, address dedupe and address-based (return-to-sender) opt-out both silently
 * fail to match, and we re-mail someone who asked us to stop.
 */
const STREET_ABBR: Record<string, string> = {
  STREET: "ST", AVENUE: "AVE", ROAD: "RD", DRIVE: "DR", BOULEVARD: "BLVD", LANE: "LN",
  COURT: "CT", CIRCLE: "CIR", HIGHWAY: "HWY", PLACE: "PL", TERRACE: "TER", PARKWAY: "PKWY",
  TRAIL: "TRL", SQUARE: "SQ", PLAZA: "PLZ", CROSSING: "XING", POINT: "PT",
  SUITE: "STE", APARTMENT: "APT", BUILDING: "BLDG", FLOOR: "FL", ROOM: "RM", DEPARTMENT: "DEPT",
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW",
};

export function normalizeStreet(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toUpperCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((tok) => STREET_ABBR[tok] ?? tok)
    .join(" ");
}

export interface NormalizedAddress {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip5?: string;
  zip4?: string;
}

/**
 * Stable key for postal dedupe and return-to-sender suppression.
 * Returns "" when the address is too thin to identify a delivery point.
 */
export function addressKeyOf(addr: NormalizedAddress | null | undefined): string {
  if (!addr?.street1 || !addr.city || !addr.state) return "";
  return [normalizeStreet(addr.street1), addr.city.toUpperCase(), addr.state.toUpperCase(), addr.zip5 ?? ""].join("|");
}

/**
 * Area keys.
 *
 * `areaKeyForCity` reuses `townSlug()` VERBATIM, so a prospect's `cityKey` is byte-identical
 * to the `Town.slug` for the same city and the two join with no mapping table.
 * The `city:` / `zip:` prefix exists so a numeric ZIP can never collide with a slug.
 */
export function areaKeyForCity(city: string, state: string): string {
  return `city:${townSlug(city, state)}`;
}

export function areaKeyForZip(zip5: string): string {
  return `zip:${zip5}`;
}

export interface ParsedArea {
  kind: "city" | "zip";
  key: string;
  label: string;
  city?: string;
  state: string;
  zip5?: string;
}

/**
 * Parse what an admin typed into a canonical area.
 * Accepts "Storm Lake", "Storm Lake, IA", "51601", "51601-1234". Returns null for garbage.
 *
 * The caller decides whether the resulting `state` is supported — the route throws
 * AREA_UNSUPPORTED for anything outside the v1 Iowa-only source.
 */
export function parseAreaQuery(input: string, defaultState = "IA"): ParsedArea | null {
  const raw = (input ?? "").trim();
  if (raw.length < 2 || raw.length > 120) return null;

  const zip = normalizeZip(raw);
  if (zip && /^\d{5}(-?\d{4})?$/.test(raw.replace(/\s/g, ""))) {
    return { kind: "zip", key: areaKeyForZip(zip.zip5), label: zip.zip5, state: defaultState, zip5: zip.zip5 };
  }

  const [cityPart, statePart] = raw.split(",").map((s) => s.trim());
  if (!cityPart || !/[a-z]/i.test(cityPart)) return null;
  const state = normalizeState(statePart) || defaultState;
  const city = toDisplayCase(cityPart);
  const key = areaKeyForCity(cityPart, state);
  if (key === "city:") return null; // slugified to nothing (e.g. "!!!")
  return { kind: "city", key, label: `${city}, ${state}`, city, state };
}

/** sha256 hex of an already-normalized key. Used by ProspectOptOut. */
export function hashKey(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}
