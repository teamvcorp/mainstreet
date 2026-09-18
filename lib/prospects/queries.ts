/**
 * Read side of the prospects feature: the city/ZIP lookup that the admin page renders.
 *
 * QUERY SHAPE: every lookup is an EQUALITY match on `cityKey` or `zip5` plus the two cached
 * boolean gates, which is exactly the compound index declared on the model. No regex ever
 * touches Mongo on this path — the admin's free-text filter runs client-side over rows we have
 * already fetched. That is both the performance story and half the injection story.
 */

import { connectToDatabase } from "@/lib/db";
import { Prospect, type IProspect } from "@/lib/models/Prospect";
import { ProspectArea, type IProspectArea, type ProspectAreaStatus } from "@/lib/models/ProspectArea";
import { parseAreaQuery, type ParsedArea } from "@/lib/prospects/normalize";
import { QUALITY_REASON_LABELS, type QualityReason } from "@/lib/prospects/quality";

const HOME_STATE = (process.env.PROSPECTS_DEFAULT_STATE ?? "IA").toUpperCase();
/**
 * Admin tables in this repo cap rather than paginate; 300 matches lib/admin.ts.
 *
 * Two separate ceilings on purpose. SCREEN_LIMIT is what a page renders when the caller asks
 * for nothing. HARD_LIMIT is the real guard rail, so an EXPORT can legitimately ask for the
 * whole list instead of being silently truncated to a screenful - which is exactly what
 * happened when both shared one constant: the page said "857 on file" and the CSV held 300.
 */
const SCREEN_LIMIT = 300;
const HARD_LIMIT = 50_000;

export interface ProspectRow {
  id: string;
  businessName: string;
  /** Raw registered agent — shown even when it is a commercial service. */
  agentName?: string;
  agentIsCommercial: boolean;
  /** Only present when the agent looked like a natural person, or an admin set it. */
  ownerName?: string;
  ownerNameSource?: string;
  email?: string;
  entityType?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip5?: string;
  /** True when the address came from the registered agent, not the principal office. */
  addressIsAgent: boolean;
  qualityOk: boolean;
  mailable: boolean;
  emailable: boolean;
  /** Human-readable "why is this excluded" strings for the UI tooltip. */
  qualityIssues: string[];
  status: string;
  suppressed: boolean;
}

export interface AreaRow {
  id: string;
  key: string;
  kind: "city" | "zip";
  label: string;
  status: ProspectAreaStatus;
  prospectCount: number;
  scannedCount: number;
  requestCount: number;
  coveredAt?: string;
  lastRequestedAt: string;
  error?: string;
}

type LeanProspect = IProspect & { _id: { toString(): string } };

/** The single mapper every prospect response goes through — no raw document ever leaves here. */
function toProspectRow(p: LeanProspect): ProspectRow {
  return {
    id: p._id.toString(),
    businessName: p.businessName,
    agentName: p.agentName,
    agentIsCommercial: !!p.agentIsCommercial,
    ownerName: p.ownerName,
    ownerNameSource: p.ownerNameSource,
    email: p.email,
    entityType: p.entityType,
    street1: p.address?.street1,
    street2: p.address?.street2,
    city: p.address?.city,
    state: p.address?.state,
    zip5: p.address?.zip5,
    addressIsAgent: !!p.addressIsAgent,
    qualityOk: !!p.qualityOk,
    mailable: !!p.mailable,
    emailable: !!p.emailable,
    qualityIssues: (p.qualityReasons ?? []).map(
      (r) => QUALITY_REASON_LABELS[r as QualityReason] ?? String(r),
    ),
    status: p.status,
    suppressed: !!p.suppressed,
  };
}

export function toAreaRow(a: IProspectArea & { _id: { toString(): string } }): AreaRow {
  return {
    id: a._id.toString(),
    key: a.key,
    kind: a.kind,
    label: a.label,
    status: a.status,
    prospectCount: a.prospectCount ?? 0,
    scannedCount: a.scannedCount ?? 0,
    requestCount: a.requestCount ?? 0,
    coveredAt: a.coveredAt ? new Date(a.coveredAt).toISOString() : undefined,
    lastRequestedAt: new Date(a.lastRequestedAt).toISOString(),
    error: a.error,
  };
}

/** Mongo filter for an area. City and ZIP are independent entry points with their own indexes. */
function filterForArea(area: ParsedArea): Record<string, unknown> {
  return area.kind === "city"
    ? { cityKey: area.key.slice("city:".length) }
    : { zip5: area.zip5 };
}

export interface LookupResult {
  /** null when the query could not be parsed as a city or ZIP. */
  area: ParsedArea | null;
  /** null when this area has never been requested. */
  areaStatus: ProspectAreaStatus | null;
  areaId: string | null;
  areaError?: string;
  /** Whether the state registry source supports this area at all (v1 is Iowa-only). */
  supported: boolean;
  rows: ProspectRow[];
  total: number;
  withEmail: number;
  excluded: number;
  truncated: boolean;
}

/**
 * Look up prospects by city or ZIP.
 *
 * ALWAYS returns whatever we already hold for the key, even when the area is not yet covered.
 * City and ZIP coverage overlap: after covering `city:storm-lake-ia`, a lookup on its ZIP finds
 * rows although `zip:50588` was never requested. Returning them (and letting the UI say so)
 * avoids the "I searched and got nothing, ingest must be broken" confusion.
 */
export async function lookupProspects(opts: {
  query?: string;
  includeExcluded?: boolean;
  limit?: number;
}): Promise<LookupResult> {
  const empty: LookupResult = {
    area: null, areaStatus: null, areaId: null, supported: true,
    rows: [], total: 0, withEmail: 0, excluded: 0, truncated: false,
  };
  const raw = (opts.query ?? "").trim();
  if (!raw) return empty;

  const area = parseAreaQuery(raw, HOME_STATE);
  if (!area) return empty;
  if (area.state !== HOME_STATE) return { ...empty, area, supported: false };

  await connectToDatabase();
  const limit = Math.min(opts.limit ?? SCREEN_LIMIT, HARD_LIMIT);
  const base = filterForArea(area);

  // The requested quality filter: a record is hidden unless it has (name + address) OR
  // (email + owner). `includeExcluded` lets an admin audit what was dropped and why.
  const filter: Record<string, unknown> = opts.includeExcluded
    ? base
    : { ...base, qualityOk: true, suppressed: false };

  const [docs, total, withEmail, okCount, ledger] = await Promise.all([
    Prospect.find(filter)
      .sort({ businessNameKey: 1 })
      .limit(limit)
      .lean<LeanProspect[]>(),
    Prospect.countDocuments(base),
    Prospect.countDocuments({ ...base, emailable: true }),
    Prospect.countDocuments({ ...base, qualityOk: true, suppressed: false }),
    ProspectArea.findOne({ key: area.key }).lean<IProspectArea & { _id: { toString(): string } }>(),
  ]);

  return {
    area,
    areaStatus: ledger?.status ?? null,
    areaId: ledger?._id?.toString() ?? null,
    areaError: ledger?.error,
    supported: true,
    rows: docs.map(toProspectRow),
    total,
    withEmail,
    excluded: total - okCount,
    truncated: docs.length >= limit,
  };
}

/** Every requested area and its coverage state, newest request first. */
export async function listProspectAreas(): Promise<AreaRow[]> {
  await connectToDatabase();
  const areas = await ProspectArea.find()
    .sort({ lastRequestedAt: -1 })
    .limit(SCREEN_LIMIT)
    .lean<(IProspectArea & { _id: { toString(): string } })[]>();
  return areas.map(toAreaRow);
}

/** Dashboard counters for the prospects landing page. */
export async function getProspectStats(): Promise<{
  prospects: number;
  mailable: number;
  withEmail: number;
  areas: number;
  covered: number;
}> {
  await connectToDatabase();
  const [prospects, mailable, withEmail, areas, covered] = await Promise.all([
    Prospect.countDocuments({}),
    Prospect.countDocuments({ mailable: true, suppressed: false }),
    Prospect.countDocuments({ emailable: true, suppressed: false }),
    ProspectArea.countDocuments({}),
    ProspectArea.countDocuments({ status: "covered" }),
  ]);
  return { prospects, mailable, withEmail, areas, covered };
}
