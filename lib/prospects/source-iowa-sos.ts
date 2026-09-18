/**
 * Iowa SOS "Active Iowa Business Entities" reader.
 *
 * THIS IS THE ONLY FILE THAT TALKS TO THE STATE DATA SERVICE.
 * The full verified contract — headers, ZIP framing hex, columns, measured throughput, and
 * curl recipes to re-verify it — lives in `docs/vendor/iowa-sos-active-business-entities-v1.md`.
 * Read that before changing anything here.
 *
 * The three facts that shape this file:
 *   1. The response is a ZIP with ONE entry, compression method 0 (STORED), so the payload is
 *      raw NDJSON and no inflate step is needed today. Method 8 is handled anyway, because a
 *      publisher can change it and silent corruption is much worse than a loud failure.
 *   2. There is NO Content-Length, NO ETag, NO Accept-Ranges. So: no progress %, no conditional
 *      GET, and no resume. The only proof we received the whole file is the trailing ZIP data
 *      descriptor — which is why finding it is a correctness check, not hygiene.
 *   3. ~205 MB at ~1.76 MiB/s from an origin-bound server = ~120 s per pass. Everything here
 *      streams with constant memory; nothing is ever buffered whole.
 *
 * Pure of `next/*` on purpose, so an ops script can import it too.
 */

import { Readable } from "node:stream";
import { createInflateRaw } from "node:zlib";
import { once } from "node:events";
import {
  toDisplayCase,
  normalizeKey,
  normalizeZip,
  normalizeState,
  addressKeyOf,
  areaKeyForCity,
  type NormalizedAddress,
} from "@/lib/prospects/normalize";
import { classifyAgent } from "@/lib/prospects/agents";

export const IOWA_SOS_URL =
  process.env.PROSPECTS_SOURCE_URL ?? "https://idh-be.iowa.gov/api/v1/datasets/554/rows.json";

/**
 * CC-BY 4.0 attribution, carried on CSV exports as the X-Data-License response header.
 *
 * MUST STAY ASCII. HTTP header values are ByteStrings (Latin-1); a single em dash here
 * throws "Cannot convert argument to a ByteString" and turns every export into a 500.
 */
export const IOWA_SOS_LICENSE =
  "CC-BY 4.0; Iowa Secretary of State, Active Iowa Business Entities (data.iowa.gov dataset 554)";

export type IowaSosErrorCode =
  | "UPSTREAM" // non-2xx or no body
  | "FORMAT" // not a ZIP/gzip/NDJSON we recognize
  | "ENCRYPTED" // ZIP general-purpose bit 0
  | "MULTI_ENTRY" // a second local header appeared
  | "TRUNCATED" // stream ended without the trailing data descriptor
  | "SCHEMA_DRIFT"; // the columns we depend on are gone

export class IowaSosError extends Error {
  constructor(
    readonly code: IowaSosErrorCode,
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = "IowaSosError";
  }
}

/** Raw row shape — all 23 columns, all UPPERCASE strings. See the vendor doc. */
export interface IowaSosRow {
  corp_number?: string;
  legal_name?: string;
  corporation_type?: string;
  effective_date?: string;
  registered_agent?: string;
  ra_address_1?: string;
  ra_address_2?: string;
  ra_city?: string;
  ra_state?: string;
  ra_zip?: string;
  ra_latitude?: number;
  ra_longitude?: number;
  home_office?: string;
  ho_address_1?: string;
  ho_address_2?: string;
  ho_city?: string;
  ho_state?: string;
  ho_zip?: string;
  ho_country?: string;
  ho_latitude?: number;
  ho_longitude?: number;
}

/** Framing observed while streaming — recorded on the run doc so a format change is visible. */
export interface ZipFraming {
  method?: number;
  flags?: number;
  fileName?: string;
  sawDataDescriptor: boolean;
  declaredUncompressedSize?: number;
  payloadBytes: number;
  bytesRead: number;
}

export function newFraming(): ZipFraming {
  return { sawDataDescriptor: false, payloadBytes: 0, bytesRead: 0 };
}

/**
 * Node's Buffer is generic over its backing store (`Buffer<ArrayBuffer>` vs
 * `Buffer<ArrayBufferLike>`), and `subarray()` / stream chunks widen to the latter. One alias
 * for all the byte plumbing keeps the generators assignable without casts.
 */
type Bytes = Buffer<ArrayBufferLike>;

const LOCAL_SIG = 0x04034b50;
/** `PK\x07\x08` — the data descriptor that follows a STORED entry written with GP bit 3. */
const DATA_DESCRIPTOR = Buffer.from([0x50, 0x4b, 0x07, 0x08]);

interface LocalHeader {
  method: number;
  flags: number;
  fileName: string;
  headerLength: number;
}

/**
 * Parse the ZIP local file header. Returns null when more bytes are needed.
 *
 * Filename and extra lengths are READ FROM BYTES 26-29, never hardcoded: the payload offset is
 * `30 + fnLen + exLen` (93 today), and a filename change would shift it.
 */
function parseLocalHeader(buf: Bytes): LocalHeader | null {
  if (buf.length < 30) return null;
  if (buf.readUInt32LE(0) !== LOCAL_SIG) {
    throw new IowaSosError("FORMAT", `Not a ZIP local header: ${buf.subarray(0, 4).toString("hex")}`);
  }
  const flags = buf.readUInt16LE(6);
  if (flags & 0x0001) throw new IowaSosError("ENCRYPTED", "Archive entry is encrypted");
  const method = buf.readUInt16LE(8);
  const fnLen = buf.readUInt16LE(26);
  const exLen = buf.readUInt16LE(28);
  const headerLength = 30 + fnLen + exLen;
  if (buf.length < headerLength) return null;
  return {
    method,
    flags,
    fileName: buf.toString(flags & 0x0800 ? "utf8" : "latin1", 30, 30 + fnLen),
    headerLength,
  };
}

/** Open the dataset and yield raw response chunks. Follows the 303 to signed GCS automatically. */
async function* openDataset(url: string, signal: AbortSignal, framing: ZipFraming): AsyncGenerator<Bytes> {
  const res = await fetch(url, {
    signal,
    headers: {
      // Identify ourselves with a contact address — state portals throttle anonymous bulk pulls.
      "user-agent":
        process.env.PROSPECTS_SOURCE_USER_AGENT ??
        "mainstreet-shops/1.0 (+https://mainstreet-shops.com)",
      accept: "application/zip, application/octet-stream, application/json",
      // Do NOT set accept-encoding: undici auto-decompresses Content-Encoding only while it
      // owns that header. Setting it yields raw gzip bytes we did not ask for.
    },
  });
  if (!res.ok || !res.body) {
    throw new IowaSosError("UPSTREAM", `Iowa data service returned HTTP ${res.status}`, res.status);
  }
  // res.body types as the DOM ReadableStream under this repo's tsconfig `lib`, which has no
  // async iterator — `for await` over it would not compile. Readable.fromWeb also gives us
  // .destroy() for a clean abort.
  const node = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  for await (const chunk of node) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    framing.bytesRead += buf.length;
    yield buf;
  }
}

/**
 * Strip the ZIP framing and yield payload bytes.
 *
 * NOTE ON ITERATION STYLE: this walks the source with the manual iterator protocol rather than
 * `for await`, because `break`ing out of a `for await` loop calls `.return()` on the async
 * generator and CLOSES it. We need to stop reading at the end of the header and then keep
 * reading the same stream for the payload, so a second `for await` would silently yield nothing.
 *
 * Method 0 (today): pass through, stopping at the `PK 07 08` sentinel.
 *   Scanning for that sentinel is safe ONLY because the payload is JSON text: 0x07 and 0x08 are
 *   control characters that cannot appear raw inside a JSON string or in JSON structure, so the
 *   sentinel cannot occur in the payload. That argument is the whole reason the shortcut is
 *   legitimate - do not copy it to the method 8 branch.
 *
 * Method 8 (if the publisher ever enables deflate): let zlib find its own end-of-stream via the
 *   final-block bit. The sentinel scan would be UNSAFE there, because deflate output is
 *   arbitrary binary and can contain those four bytes by chance.
 */
async function* zipPayload(source: AsyncGenerator<Bytes>, framing: ZipFraming): AsyncGenerator<Bytes> {
  const it = source[Symbol.asyncIterator]();
  let head: Bytes = Buffer.alloc(0);
  let header: LocalHeader | null = null;

  // Accumulate just enough bytes to read the local header.
  for (;;) {
    const next = await it.next();
    if (next.done) break;
    head = head.length ? Buffer.concat([head, next.value]) : next.value;

    // Sniff before assuming ZIP, so a format switch fails loudly instead of producing garbage.
    if (head.length >= 2) {
      const b0 = head[0];
      const b1 = head[1];
      const isZip = b0 === 0x50 && b1 === 0x4b;
      const isGzip = b0 === 0x1f && b1 === 0x8b;
      const isJson = b0 === 0x7b || b0 === 0x5b;
      if (!isZip && !isGzip && !isJson) {
        throw new IowaSosError("FORMAT", `Unrecognized payload magic ${head.subarray(0, 4).toString("hex")}`);
      }
      if (isJson) {
        // Publisher switched to plain NDJSON - pass everything straight through.
        framing.method = -1;
        framing.payloadBytes += head.length;
        yield head;
        for (;;) {
          const n = await it.next();
          if (n.done) return;
          framing.payloadBytes += n.value.length;
          yield n.value;
        }
      }
    }

    header = parseLocalHeader(head);
    if (header) break;
  }

  if (!header) throw new IowaSosError("FORMAT", "Stream ended before a complete ZIP header");
  framing.method = header.method;
  framing.flags = header.flags;
  framing.fileName = header.fileName;
  const rest: Bytes = head.subarray(header.headerLength);

  if (header.method === 8) {
    yield* inflateEntry(rest, it, framing);
    return;
  }
  if (header.method !== 0) {
    throw new IowaSosError("FORMAT", `Unsupported ZIP compression method ${header.method}`);
  }

  // STORED: emit until the data descriptor sentinel.
  const emit = (buf: Bytes): Bytes | null => {
    const at = buf.indexOf(DATA_DESCRIPTOR);
    if (at === -1) {
      framing.payloadBytes += buf.length;
      return buf.length ? buf : null;
    }
    framing.sawDataDescriptor = true;
    const tail = buf.subarray(at);
    // Zip64 data descriptor: sig(4) crc(4) compressedSize(8) uncompressedSize(8).
    if (tail.length >= 24) framing.declaredUncompressedSize = Number(tail.readBigUInt64LE(16));
    const payload = buf.subarray(0, at);
    framing.payloadBytes += payload.length;
    return payload.length ? payload : null;
  };

  const first = emit(rest);
  if (first) yield first;

  while (!framing.sawDataDescriptor) {
    const next = await it.next();
    if (next.done) break;
    const out = emit(next.value);
    if (out) yield out;
  }
}

/** Deflate branch: feed zlib manually and stop at end-of-stream so the ZIP trailer never reaches it. */
async function* inflateEntry(
  firstChunk: Bytes,
  it: AsyncIterator<Bytes>,
  framing: ZipFraming,
): AsyncGenerator<Bytes> {
  const inflate = createInflateRaw();
  let ended = false;
  inflate.on("end", () => {
    ended = true;
  });

  const pump = (async () => {
    try {
      if (firstChunk.length && !inflate.write(firstChunk)) await once(inflate, "drain");
      for (;;) {
        if (ended) break;
        const next = await it.next();
        if (next.done) break;
        if (!inflate.write(next.value)) await once(inflate, "drain");
      }
    } catch {
      // Writing after end-of-stream is expected once the entry finishes; ignore.
    } finally {
      inflate.end();
    }
  })();

  for await (const out of inflate) {
    const buf: Bytes = Buffer.isBuffer(out) ? out : Buffer.from(out as Uint8Array);
    framing.payloadBytes += buf.length;
    yield buf;
  }
  framing.sawDataDescriptor = ended; // zlib end-of-stream is the completeness proof here.
  await pump;
}

/**
 * Split payload bytes into NDJSON lines.
 *
 * SPLIT ON BUFFER, NOT STRING. A JSON object will straddle chunk boundaries, and the carry-over
 * can land mid-UTF-8-sequence — `chunk.toString()` on each chunk then concatenating corrupts
 * multi-byte characters. Working in bytes and decoding only whole lines avoids that entirely.
 * `carry` holds at most one line (~450 bytes), so memory stays flat.
 */
async function* ndjsonLines(payload: AsyncGenerator<Bytes>): AsyncGenerator<string> {
  let carry: Bytes = Buffer.alloc(0);
  for await (const chunk of payload) {
    const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    let start = 0;
    let nl: number;
    while ((nl = buf.indexOf(0x0a, start)) !== -1) {
      let end = nl;
      if (end > start && buf[end - 1] === 0x0d) end--; // tolerate CRLF
      if (end > start) yield buf.toString("utf8", start, end);
      start = nl + 1;
    }
    carry = buf.subarray(start);
  }
  // The final object has no trailing newline before the ZIP trailer.
  if (carry.length) yield carry.toString("utf8");
}

/** Stream the dataset as NDJSON lines. Caller applies the prefilter before JSON.parse. */
export async function* streamIowaSosLines(opts: {
  signal: AbortSignal;
  framing: ZipFraming;
  url?: string;
}): AsyncGenerator<string> {
  const source = openDataset(opts.url ?? IOWA_SOS_URL, opts.signal, opts.framing);
  yield* ndjsonLines(zipPayload(source, opts.framing));
}

/**
 * Did we demonstrably receive the whole file?
 *
 * With no Content-Length on the response, the trailing ZIP data descriptor is the ONLY
 * completeness signal, and an area may only be promoted to `covered` when this passes.
 *
 * The descriptor carries the entry's uncompressed size, so when it is present we have an EXACT
 * byte-level check and no line-count heuristic is needed - which matters, because a hardcoded
 * line floor is a guess that silently rejects good passes when the dataset shrinks. (It did:
 * the first version used 400k, and this dataset holds ~345k ACTIVE entities. The widely quoted
 * "600,000+" figure counts inactive ones too.)
 *
 * `minLines` is only consulted on the deflate path, where no declared size is available.
 */
export function isCompletePass(
  framing: ZipFraming,
  linesRead: number,
  minLines?: number,
): { complete: boolean; reason?: string } {
  if (!framing.sawDataDescriptor) {
    return { complete: false, reason: "stream ended before the ZIP data descriptor (truncated)" };
  }
  const declared = framing.declaredUncompressedSize;
  if (typeof declared === "number" && declared > 0) {
    if (declared === framing.payloadBytes) return { complete: true };
    return {
      complete: false,
      reason: `payload size mismatch: read ${framing.payloadBytes} bytes, archive declared ${declared}`,
    };
  }
  if (typeof minLines === "number" && linesRead < minLines) {
    return { complete: false, reason: `only ${linesRead} lines read, expected at least ${minLines}` };
  }
  return linesRead > 0
    ? { complete: true }
    : { complete: false, reason: "no rows were read" };
}

// ─── ROW MAPPING ────────────────────────────────────────────────────────────

export interface MappedProspect {
  sourceId: string;
  businessName: string;
  businessNameKey: string;
  entityType?: string;
  sourceEffectiveDate?: Date;
  agentName?: string;
  agentIsCommercial: boolean;
  ownerName?: string;
  address: NormalizedAddress;
  addressSource: "principal_office" | "registered_agent";
  addressIsAgent: boolean;
  addressKey?: string;
  /** Bare town slug, no "city:" prefix — byte-identical to the matching Town.slug. */
  cityKey: string;
  zip5?: string;
  state: string;
  lat?: number;
  lng?: number;
}

interface Candidate extends NormalizedAddress {
  lat?: number;
  lng?: number;
}

function candidate(
  street1?: string, street2?: string, city?: string, state?: string,
  zip?: string, lat?: number, lng?: number,
): Candidate {
  const z = normalizeZip(zip);
  return {
    street1: toDisplayCase(street1) || undefined,
    street2: toDisplayCase(street2) || undefined,
    city: toDisplayCase(city) || undefined,
    state: normalizeState(state) || undefined,
    zip5: z?.zip5,
    zip4: z?.zip4,
    lat: typeof lat === "number" ? lat : undefined,
    lng: typeof lng === "number" ? lng : undefined,
  };
}

/**
 * Choose ONE address per row. NEVER union the principal-office and registered-agent cities.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS: registered agents are overwhelmingly attorneys,
 * accountants and national agent services, concentrated in Des Moines and Cedar Rapids.
 * Unioning would drop every Iowa LLC whose lawyer is in Des Moines into the Des Moines prospect
 * list, and would put a Des Moines business into Storm Lake's list because its agent happens to
 * live there. The address we MATCH on must be the address we STORE and DISPLAY, or the list
 * lies about where the business is.
 *
 * Preference: in-state principal office, then in-state agent, then whichever is complete.
 * An out-of-state HQ (a Delaware holding company) can never match an Iowa area, so falling back
 * to the Iowa agent address is the useful behavior rather than a compromise.
 */
function pickAddress(
  row: IowaSosRow,
  homeState: string,
): { addr: Candidate; source: "principal_office" | "registered_agent" } | null {
  const ho = candidate(row.ho_address_1, row.ho_address_2, row.ho_city, row.ho_state, row.ho_zip, row.ho_latitude, row.ho_longitude);
  const ra = candidate(row.ra_address_1, row.ra_address_2, row.ra_city, row.ra_state, row.ra_zip, row.ra_latitude, row.ra_longitude);

  const hoComplete = !!(ho.street1 && ho.city);
  const raComplete = !!(ra.street1 && ra.city);

  if (hoComplete && ho.state === homeState) return { addr: ho, source: "principal_office" };
  if (raComplete && ra.state === homeState) return { addr: ra, source: "registered_agent" };
  if (hoComplete) return { addr: ho, source: "principal_office" };
  if (raComplete) return { addr: ra, source: "registered_agent" };
  if (ho.city) return { addr: ho, source: "principal_office" };
  if (ra.city) return { addr: ra, source: "registered_agent" };
  return null;
}

/** Map a raw source row to the fields the ingest writes. Returns null when unusable. */
export function mapIowaSosRow(row: IowaSosRow, homeState = "IA"): MappedProspect | null {
  const sourceId = (row.corp_number ?? "").trim();
  const legalName = (row.legal_name ?? "").trim();
  if (!sourceId || !legalName) return null;

  const picked = pickAddress(row, homeState);
  if (!picked) return null;
  const { addr, source } = picked;

  const agentRaw = (row.registered_agent ?? "").trim();
  const agent = classifyAgent(agentRaw, legalName);
  const effective = row.effective_date ? new Date(row.effective_date) : undefined;
  const cityAreaKey = addr.city ? areaKeyForCity(addr.city, addr.state ?? homeState) : "";

  return {
    sourceId,
    businessName: toDisplayCase(legalName),
    businessNameKey: normalizeKey(legalName),
    entityType: toDisplayCase(row.corporation_type) || undefined,
    sourceEffectiveDate: effective && !Number.isNaN(effective.getTime()) ? effective : undefined,
    agentName: toDisplayCase(agentRaw) || undefined,
    agentIsCommercial: agent.isCommercial,
    // ownerName is set ONLY for a plausible natural person — see lib/prospects/agents.ts.
    ownerName: agent.looksLikePerson && !agent.isCommercial ? toDisplayCase(agentRaw) : undefined,
    address: {
      street1: addr.street1,
      street2: addr.street2,
      city: addr.city,
      state: addr.state,
      zip5: addr.zip5,
      zip4: addr.zip4,
    },
    addressSource: source,
    addressIsAgent: source === "registered_agent",
    addressKey: addressKeyOf(addr) || undefined,
    cityKey: cityAreaKey ? cityAreaKey.slice("city:".length) : "",
    zip5: addr.zip5,
    state: addr.state ?? homeState,
    lat: addr.lat,
    lng: addr.lng,
  };
}
