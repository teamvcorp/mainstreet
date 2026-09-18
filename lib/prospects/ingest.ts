/**
 * The prospect ingest pass.
 *
 * ONE DOWNLOAD SATISFIES EVERY PENDING AREA. The source dump is unordered, so a city's rows are
 * scattered across all ~600k lines and there is no point before EOF at which an area is known
 * complete. A pass therefore claims every pending area up front, tests each row against an
 * in-memory key set, and promotes them together only after proving it reached the end.
 * Never one download per area — that would be ~205 MB each.
 *
 * Pure of `next/*` so an ops script can import it.
 */

import { connectToDatabase } from "@/lib/db";
import { Prospect } from "@/lib/models/Prospect";
import { ProspectArea, type IProspectArea } from "@/lib/models/ProspectArea";
import { ProspectIngestRun } from "@/lib/models/ProspectIngestRun";
import {
  IOWA_SOS_URL,
  IowaSosError,
  isCompletePass,
  mapIowaSosRow,
  newFraming,
  streamIowaSosLines,
  type IowaSosRow,
  type MappedProspect,
} from "@/lib/prospects/source-iowa-sos";
import { evaluateProspectQuality } from "@/lib/prospects/quality";
import type { AnyBulkWriteOperation } from "mongoose";
import type { IProspect } from "@/lib/models/Prospect";

const DEFAULT_MAX_MS = Number(process.env.PROSPECTS_INGEST_MAX_MS ?? 240_000);
const HOME_STATE = (process.env.PROSPECTS_DEFAULT_STATE ?? "IA").toUpperCase();
const BATCH_SIZE = 1_000;
const LEASE_MS = 15 * 60_000;
const HEARTBEAT_MS = 30_000;
/** Circuit breaker: a single area matching this many rows means a bad request, not a city. */
const MAX_ROWS_PER_AREA = 100_000;

export interface PassResult {
  runId: string;
  status: "complete" | "partial" | "failed" | "noop";
  areaKeys: string[];
  linesRead: number;
  prefilterHits: number;
  rowsMatched: number;
  rowsKept: number;
  upserted: number;
  modified: number;
  durationMs: number;
  error?: string;
}

/**
 * Sanitize a prefilter token.
 *
 * Tokens come from our own ProspectArea documents, but those were created from admin-typed
 * text, so this WHITELISTS rather than escapes: anything outside [A-Z0-9 .'&-] is dropped.
 * A whitelist cannot fall out of date the way an escape list can, and it removes every regex
 * metacharacter that could cause catastrophic backtracking. The only survivor with special
 * meaning is `.`, rewritten as the character class [.] so it matches a literal dot.
 */
function regexToken(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9 .'&-]/g, "")
    .replace(/[.]/g, "[.]")
    .trim();
}

interface AreaIndex {
  /** bare town slugs (no "city:" prefix) -> area key */
  citySlugs: Map<string, string>;
  /** zip5 -> area key */
  zips: Map<string, string>;
  prefilter: RegExp | null;
}

/**
 * Build the row prefilter and the exact-match index from the COMPLETE covered set.
 *
 * The prefilter is one alternation regex rather than a loop of indexOf per token. Measured on
 * 600k lines of the real row shape: one regex 108 ms, blind JSON.parse 1,365 ms, indexOf loop
 * 2,367 ms. The obvious approach is the slowest one.
 *
 * Tokens are quoted (`"STORM LAKE"`), so the regex matches any field whose value equals the
 * token — a strict SUPERSET of a true city/ZIP match, which is exactly what a prefilter should
 * be. False positives (a business literally named "STORM LAKE" located elsewhere) are rejected
 * by the exact check in `matchRow`.
 */
function buildAreaIndex(areas: IProspectArea[]): AreaIndex {
  const citySlugs = new Map<string, string>();
  const zips = new Map<string, string>();
  const tokens: string[] = [];

  for (const a of areas) {
    if (a.kind === "city") {
      const slug = a.key.slice("city:".length);
      citySlugs.set(slug, a.key);
      for (const alias of a.aliases ?? []) citySlugs.set(alias, a.key);
      if (a.city) tokens.push(a.city.toUpperCase());
      // The source stores city names uppercase and unpunctuated-ish; add the de-slugged form
      // so "storm-lake-ia" also matches the literal "STORM LAKE".
      tokens.push(slug.replace(/-[a-z]{2}$/, "").replace(/-/g, " ").toUpperCase());
    } else if (a.zip5) {
      zips.set(a.zip5, a.key);
      tokens.push(a.zip5);
    }
  }

  const unique = [...new Set(tokens.map(regexToken).filter(Boolean))];
  const prefilter = unique.length
    ? new RegExp(`"(?:${unique.join("|")})"`)
    : null;

  return { citySlugs, zips, prefilter };
}

/**
 * Which covered areas does this row belong to?
 *
 * A row can match by city AND by ZIP, so it may carry two area keys — which is why
 * sum(perArea.matched) can legitimately exceed rowsKept.
 */
function matchRow(mapped: MappedProspect, index: AreaIndex): string[] {
  const keys: string[] = [];
  if (mapped.cityKey && index.citySlugs.has(mapped.cityKey)) {
    keys.push(index.citySlugs.get(mapped.cityKey)!);
  }
  if (mapped.zip5 && index.zips.has(mapped.zip5)) {
    keys.push(index.zips.get(mapped.zip5)!);
  }
  return keys;
}

/**
 * SOURCE-OWNED vs ADMIN-OWNED.
 *
 * `$set` carries only source-owned fields; everything an admin can edit goes in `$setOnInsert`,
 * which fires ONLY on the first insert. On every later pass the document already exists, so the
 * admin-owned fields are never named in the update and cannot be touched. That is the entire
 * mechanism protecting a typed-in email, notes, status, and — most importantly — an opt-out.
 *
 * There is deliberately no `areaKeys` array on the document: `cityKey` and `zip5` already ARE
 * the lookup keys, and the compound indexes are built on them, so an area key maps directly to
 * a query (`city:storm-lake-ia` -> { cityKey: "storm-lake-ia" }). One less field to keep in sync.
 *
 * If you add a field to Prospect, decide which list it belongs in. Putting an admin-editable
 * field in the $set below silently destroys that data on the next pass, with no error.
 */
function upsertOp(mapped: MappedProspect, now: Date): AnyBulkWriteOperation<IProspect> {
  const quality = evaluateProspectQuality({
    businessName: mapped.businessName,
    ownerName: mapped.ownerName,
    email: null, // the registry has no email; an admin may add one later
    address: mapped.address,
  });

  return {
    updateOne: {
      filter: { source: "ia_sos", sourceId: mapped.sourceId },
      update: {
        $set: {
          sourceFetchedAt: now,
          sourceEffectiveDate: mapped.sourceEffectiveDate,
          entityType: mapped.entityType,
          businessName: mapped.businessName,
          businessNameKey: mapped.businessNameKey,
          agentName: mapped.agentName,
          agentIsCommercial: mapped.agentIsCommercial,
          address: mapped.address,
          addressSource: mapped.addressSource,
          addressIsAgent: mapped.addressIsAgent,
          addressKey: mapped.addressKey,
          cityKey: mapped.cityKey,
          zip5: mapped.zip5,
          state: mapped.state,
          lat: mapped.lat,
          lng: mapped.lng,
          // Quality is recomputed from source fields only. The [id] PATCH route recomputes it
          // again with the admin's email in scope, which is what lets a typed-in email flip a
          // record from excluded to included.
          qualityOk: quality.ok,
          mailable: quality.mailable,
          qualityReasons: quality.reasons,
        },
        $setOnInsert: {
          source: "ia_sos",
          sourceId: mapped.sourceId,
          // ── ADMIN-OWNED. Never in $set. ──
          ownerName: mapped.ownerName,
          ownerNameSource: mapped.ownerName ? "registered_agent" : undefined,
          emailable: false,
          status: "new",
          suppressed: false,
        },
      },
      upsert: true,
    },
  } as AnyBulkWriteOperation<IProspect>;
}

interface Counters {
  linesRead: number;
  prefilterHits: number;
  rowsMatched: number;
  rowsKept: number;
  parseErrors: number;
  upserted: number;
  modified: number;
  perArea: Map<string, number>;
}

/**
 * Batched, unordered upserts with a depth-1 write pipeline: the next batch is parsed while the
 * previous one is in flight, but `await inFlight` before starting another flush means the parse
 * loop still blocks if Mongo falls behind. Backpressure survives, memory stays bounded at two
 * batches (~1 MB), and we never accumulate matched rows.
 */
class Writer {
  private ops: AnyBulkWriteOperation<IProspect>[] = [];
  private inFlight: Promise<void> | null = null;

  constructor(private counters: Counters) {}

  async add(op: AnyBulkWriteOperation<IProspect>): Promise<void> {
    this.ops.push(op);
    if (this.ops.length >= BATCH_SIZE) await this.flush();
  }

  async flush(): Promise<void> {
    if (!this.ops.length) return;
    const batch = this.ops;
    this.ops = [];
    if (this.inFlight) await this.inFlight;
    this.inFlight = (async () => {
      const res = await Prospect.bulkWrite(batch, { ordered: false });
      this.counters.upserted += res.upsertedCount ?? 0;
      this.counters.modified += res.modifiedCount ?? 0;
    })();
  }

  async drain(): Promise<void> {
    await this.flush();
    if (this.inFlight) await this.inFlight;
    this.inFlight = null;
  }
}

/**
 * Acquire the run lock.
 *
 * The unique partial index on `{ status: "running" }` means MongoDB physically permits one
 * running document, so two passes can never both pull 205 MB. This is a DB lock rather than a
 * rate limit on purpose: `rateLimit()` no-ops when Upstash env vars are absent, so it would not
 * hold in local dev, and the cost of a double pass is real bandwidth from a state agency.
 *
 * A SIGKILLed function leaves `status: "running"` forever, so a stale lease is taken over.
 */
async function acquireRun(trigger: "cron" | "admin" | "script") {
  const now = new Date();
  try {
    return await ProspectIngestRun.create({
      status: "running",
      trigger,
      startedAt: now,
      lockedUntil: new Date(now.getTime() + LEASE_MS),
      sourceUrl: IOWA_SOS_URL,
    });
  } catch (err) {
    if ((err as { code?: number })?.code !== 11000) throw err;
    const holder = await ProspectIngestRun.findOne({ status: "running" });
    if (holder && holder.lockedUntil && holder.lockedUntil.getTime() < now.getTime()) {
      holder.status = "failed";
      holder.error = "Lease expired — taken over by a later pass.";
      holder.finishedAt = now;
      await holder.save();
      return acquireRun(trigger);
    }
    throw new Error("INGEST_RUNNING");
  }
}

/**
 * Run one streaming pass over the source, writing only rows that belong to a covered area.
 *
 * Returns `noop` immediately when nothing is pending, so a daily cron costs ~nothing.
 */
export async function runProspectPass(opts: {
  trigger: "cron" | "admin" | "script";
  maxMs?: number;
  /** Diagnostic mode: stream and count, write nothing. */
  dryRun?: boolean;
}): Promise<PassResult> {
  const maxMs = opts.maxMs ?? DEFAULT_MAX_MS;
  const started = Date.now();
  await connectToDatabase();

  // Await index builds BEFORE the first bulk upsert. Without this, Mongoose's lazy autoIndex can
  // let the first pass insert duplicates before the unique { source, sourceId } index exists.
  await Prospect.init();
  await ProspectArea.init();
  await ProspectIngestRun.init();

  // Pending work first — if there is none, don't take the lock or touch the network.
  const pending = await ProspectArea.countDocuments({
    status: { $in: ["requested", "queued", "failed"] },
  });
  if (pending === 0) {
    return {
      runId: "", status: "noop", areaKeys: [], linesRead: 0, prefilterHits: 0,
      rowsMatched: 0, rowsKept: 0, upserted: 0, modified: 0, durationMs: Date.now() - started,
    };
  }

  const run = await acquireRun(opts.trigger);
  const runId = run._id.toString();
  const counters: Counters = {
    linesRead: 0, prefilterHits: 0, rowsMatched: 0, rowsKept: 0,
    parseErrors: 0, upserted: 0, modified: 0, perArea: new Map(),
  };
  const framing = newFraming();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), maxMs);

  // "noop" returned earlier, before the lock — it can never appear from here on.
  let status: Exclude<PassResult["status"], "noop"> = "failed";
  let errorMessage: string | undefined;

  try {
    await ProspectArea.updateMany(
      { status: { $in: ["requested", "queued", "failed"] } },
      { $set: { status: "running", lastRunId: run._id } },
    );

    // Load the COMPLETE covered set, not just what we claimed. The prefilter and key index must
    // reflect every area we hold data for; indexing only the claimed subset would under-match.
    const areas = await ProspectArea.find({ status: { $in: ["running", "covered", "empty"] } }).lean<IProspectArea[]>();
    const claimedKeys = areas.filter((a) => a.status === "running").map((a) => a.key);
    run.areaKeys = claimedKeys;
    await run.save();

    const index = buildAreaIndex(areas);
    if (!index.prefilter) throw new Error("EMPTY_AUDIENCE");

    const writer = new Writer(counters);
    let lastBeat = Date.now();

    for await (const line of streamIowaSosLines({ signal: controller.signal, framing })) {
      counters.linesRead++;

      if (!index.prefilter.test(line)) continue;
      counters.prefilterHits++;

      let row: IowaSosRow;
      try {
        row = JSON.parse(line) as IowaSosRow;
      } catch {
        counters.parseErrors++;
        continue;
      }

      const mapped = mapIowaSosRow(row, HOME_STATE);
      if (!mapped) continue;
      const keys = matchRow(mapped, index);
      if (keys.length === 0) continue; // prefilter false positive — rejected here

      counters.rowsMatched++;
      for (const k of keys) {
        const n = (counters.perArea.get(k) ?? 0) + 1;
        counters.perArea.set(k, n);
        if (n > MAX_ROWS_PER_AREA) throw new Error("AREA_TOO_LARGE");
      }

      if (!opts.dryRun) await writer.add(upsertOp(mapped, new Date()));
      counters.rowsKept++;

      // Soft deadline: a clean partial with an accurate ledger beats a SIGKILL that leaves the
      // lock held and the areas stuck in `running`.
      if (Date.now() - started > maxMs) break;

      if (Date.now() - lastBeat > HEARTBEAT_MS) {
        lastBeat = Date.now();
        await ProspectIngestRun.updateOne(
          { _id: run._id },
          { $set: { lockedUntil: new Date(Date.now() + LEASE_MS), linesRead: counters.linesRead, rowsKept: counters.rowsKept } },
        );
      }
    }

    await writer.drain();
    const completeness = isCompletePass(framing, counters.linesRead);
    status = completeness.complete ? "complete" : "partial";
    if (!completeness.complete) errorMessage = completeness.reason;
    await promoteAreas(claimedKeys, counters, status, run._id.toString(), opts.dryRun ?? false);
  } catch (err) {
    errorMessage = err instanceof IowaSosError ? `${err.code}: ${err.message}` : (err as Error).message;
    status = errorMessage === "INGEST_RUNNING" ? "failed" : "partial";
    // Rows found before the failure are already committed — they are upserts keyed on
    // corp_number, so a re-run re-converges. Rolling back would discard real data AND could not
    // work: thousands of upserts exceed the 16 MB oplog-entry limit and the transaction timeout.
    await ProspectArea.updateMany(
      { status: "running" },
      { $set: { status: "queued", error: errorMessage?.slice(0, 300) } },
    );
    if (errorMessage === "INGEST_RUNNING") throw err;
  } finally {
    clearTimeout(timer);
    await ProspectIngestRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status,
          finishedAt: new Date(),
          lockedUntil: null,
          bytesRead: framing.bytesRead,
          payloadBytes: framing.payloadBytes,
          linesRead: counters.linesRead,
          prefilterHits: counters.prefilterHits,
          rowsMatched: counters.rowsMatched,
          rowsKept: counters.rowsKept,
          parseErrors: counters.parseErrors,
          zipMethod: framing.method,
          zipFlags: framing.flags,
          zipFileName: framing.fileName,
          sawDataDescriptor: framing.sawDataDescriptor,
          declaredUncompressedSize: framing.declaredUncompressedSize,
          error: errorMessage?.slice(0, 500),
        },
      },
    );
  }

  console.log(
    `[prospect-ingest ${runId}] ${status} | ${counters.linesRead} lines | ${framing.bytesRead} bytes | ` +
      `prefilter ${counters.prefilterHits} | kept ${counters.rowsKept} | areas ${run.areaKeys.length}`,
  );

  return {
    runId, status, areaKeys: run.areaKeys,
    linesRead: counters.linesRead, prefilterHits: counters.prefilterHits,
    rowsMatched: counters.rowsMatched, rowsKept: counters.rowsKept,
    upserted: counters.upserted, modified: counters.modified,
    durationMs: Date.now() - started, error: errorMessage,
  };
}

/**
 * Promote areas after a pass.
 *
 * An area may only reach `covered` when the pass PROVED it reached EOF (see `isCompletePass` —
 * with no Content-Length, the trailing ZIP data descriptor is the only completeness signal).
 *
 * A failed refresh never demotes an already-covered area: it goes back to `covered` with the
 * error recorded, so the UI can say "showing data from Sep 3, last refresh failed" instead of
 * hiding rows we already hold.
 */
async function promoteAreas(
  claimedKeys: string[],
  counters: Counters,
  status: "complete" | "partial" | "failed" | "noop",
  runId: string,
  dryRun: boolean,
): Promise<void> {
  const now = new Date();

  for (const key of claimedKeys) {
    const matched = counters.perArea.get(key) ?? 0;

    // A dry run wrote nothing, so it must NEVER claim coverage — otherwise the area looks
    // covered while the database is empty, and the next real pass skips it as a no-op.
    // It still records what it FOUND, which is the whole point of running one.
    if (dryRun) {
      await ProspectArea.updateOne(
        { key },
        {
          $set: {
            status: "requested",
            scannedCount: matched,
            error: `Dry run ${runId} found ${matched} matching business(es). Run for real to save them.`,
          },
        },
      );
      continue;
    }

    if (status !== "complete") {
      // Nothing is promoted on an incomplete pass; the rows we did write are still committed.
      await ProspectArea.updateOne(
        { key },
        {
          $set: {
            status: "queued",
            scannedCount: matched,
            error: `Pass ${runId} ended early (${status}). Rows found so far are saved — run again to finish.`,
          },
        },
      );
      continue;
    }

    const area = await ProspectArea.findOne({ key });
    if (!area) continue;
    const filter = area.kind === "city"
      ? { cityKey: key.slice("city:".length) }
      : { zip5: area.zip5 };
    const prospectCount = await Prospect.countDocuments(filter);

    // NOTE: Mongoose strips `undefined` out of a $set, so assigning `error: undefined` would
    // silently LEAVE a stale message on a healthy area. Clearing needs an explicit $unset.
    const empty = prospectCount === 0;
    await ProspectArea.updateOne(
      { key },
      empty
        ? {
            $set: {
              status: "empty",
              coveredAt: now,
              scannedCount: matched,
              prospectCount,
              error: "Covered, but no rows matched. Check the spelling, or add a spelling alias.",
            },
          }
        : {
            $set: { status: "covered", coveredAt: now, scannedCount: matched, prospectCount },
            $unset: { error: "" },
          },
    );
  }
}
