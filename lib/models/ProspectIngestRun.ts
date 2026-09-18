import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * One document per ingest pass — history, diagnostics, AND the run lock.
 *
 * THE RUN LOCK: the unique partial index on `{ status: "running" }` means MongoDB physically
 * permits only one running document, so two passes can never both pull 205 MB. This is
 * deliberately a DB lock rather than a rate limit, because `rateLimit()` no-ops when Upstash
 * env vars are absent — the lock must hold in local dev too.
 *
 * Stale-lock takeover: a killed function leaves `status: "running"` forever, so a pass that
 * finds a holder with `lockedUntil < now` flips it to `failed` and proceeds.
 */

export type ProspectRunStatus = "running" | "complete" | "partial" | "failed";
export type ProspectRunTrigger = "cron" | "admin" | "script";

export interface IProspectIngestRun {
  _id: Types.ObjectId;
  status: ProspectRunStatus;
  trigger: ProspectRunTrigger;
  /** Area keys in scope for this pass. */
  areaKeys: string[];
  startedAt: Date;
  finishedAt?: Date;
  /** Lease expiry, heartbeated forward while streaming. */
  lockedUntil?: Date;

  bytesRead: number;
  /** Bytes of NDJSON payload, excluding ZIP framing — compared against the declared size. */
  payloadBytes: number;
  linesRead: number;
  /** Lines that hit the prefilter regex (a superset of real matches). */
  prefilterHits: number;
  /** Rows whose derived area keys actually intersected the covered set. */
  rowsMatched: number;
  rowsKept: number;
  rowsRejected: number;
  parseErrors: number;

  /** ZIP framing observed, so a publisher format change is visible in the run history. */
  zipMethod?: number;
  zipFlags?: number;
  zipFileName?: string;
  sawDataDescriptor?: boolean;
  declaredUncompressedSize?: number;

  sourceUrl?: string;
  error?: string;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProspectIngestRunSchema = new Schema<IProspectIngestRun>(
  {
    status: {
      type: String,
      enum: ["running", "complete", "partial", "failed"],
      required: true,
      default: "running",
    },
    trigger: { type: String, enum: ["cron", "admin", "script"], required: true },
    areaKeys: { type: [String], default: [] },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    lockedUntil: Date,

    bytesRead: { type: Number, default: 0 },
    payloadBytes: { type: Number, default: 0 },
    linesRead: { type: Number, default: 0 },
    prefilterHits: { type: Number, default: 0 },
    rowsMatched: { type: Number, default: 0 },
    rowsKept: { type: Number, default: 0 },
    rowsRejected: { type: Number, default: 0 },
    parseErrors: { type: Number, default: 0 },

    zipMethod: Number,
    zipFlags: Number,
    zipFileName: String,
    sawDataDescriptor: Boolean,
    declaredUncompressedSize: Number,

    sourceUrl: String,
    error: String,
    errorCode: String,
  },
  { timestamps: true, collection: "prospectingestruns" },
);

// THE RUN LOCK — see the file header. Partial so only running documents contend.
ProspectIngestRunSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: "running" } },
);

// Run-history panel, newest first. TTL keeps diagnostics from growing without bound.
ProspectIngestRunSchema.index({ startedAt: -1 });
ProspectIngestRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const ProspectIngestRun: Model<IProspectIngestRun> =
  models.ProspectIngestRun ||
  model<IProspectIngestRun>("ProspectIngestRun", ProspectIngestRunSchema);
