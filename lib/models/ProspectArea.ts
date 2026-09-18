import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * The lazy-coverage ledger: which cities / ZIPs an admin has asked us to pull from the state
 * registry, and how far each one got.
 *
 * WHY COVERAGE IS PER-AREA AND WHY AN AREA ONLY GOES `covered` AT EOF:
 * the source dump is unordered — a city's rows are scattered across all ~600k lines — so there
 * is no point before end-of-file at which an area is known to be complete. That is a constraint
 * of the data, not a design preference. One streaming pass therefore claims EVERY pending area
 * up front and promotes them together once it proves it reached the end.
 */

export type ProspectAreaKind = "city" | "zip";
export type ProspectAreaStatus =
  | "requested" // an admin asked for it; not yet picked up by a pass
  | "queued" // claimed for the next pass, or left over from a partial pass
  | "running" // a pass is currently scanning for it
  | "covered" // a pass reached EOF with this area in scope
  | "failed" // a pass died while this area was still un-covered
  | "empty"; // covered successfully, but zero rows matched (check spelling / add an alias)

export interface IProspectArea {
  _id: Types.ObjectId;
  kind: ProspectAreaKind;
  /** "city:storm-lake-ia" | "zip:51601" — the natural key. */
  key: string;
  /** "Storm Lake, IA" | "51601" */
  label: string;
  city?: string;
  state: string;
  zip5?: string;
  /**
   * Extra city spellings to match in the source, as bare town slugs.
   * The dataset writes "SAINT ANSGAR"; an admin types "St. Ansgar"; those slugify differently.
   * Without an alias the area covers with zero rows and looks like a broken parser.
   */
  aliases: string[];
  status: ProspectAreaStatus;
  requestedBy?: Types.ObjectId;
  requestCount: number;
  lastRequestedAt: Date;
  lastRunId?: Types.ObjectId;
  coveredAt?: Date;
  /** Rows written for this area on the last completed pass. */
  prospectCount: number;
  /** Rows that matched this area's keys on the last completed pass (before quality filtering). */
  scannedCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProspectAreaSchema = new Schema<IProspectArea>(
  {
    kind: { type: String, enum: ["city", "zip"], required: true },
    key: { type: String, required: true, lowercase: true, trim: true },
    label: { type: String, required: true },
    city: String,
    state: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    zip5: String,
    aliases: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["requested", "queued", "running", "covered", "failed", "empty"],
      default: "requested",
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    requestCount: { type: Number, default: 0 },
    lastRequestedAt: { type: Date, default: Date.now },
    lastRunId: { type: Schema.Types.ObjectId, ref: "ProspectIngestRun" },
    coveredAt: Date,
    prospectCount: { type: Number, default: 0 },
    scannedCount: { type: Number, default: 0 },
    error: String,
  },
  { timestamps: true, collection: "prospectareas" },
);

// The natural key. "Request this area" is a single idempotent upsert with $inc on requestCount,
// so a double-clicked button cannot create two ledger rows.
ProspectAreaSchema.index({ key: 1 }, { unique: true });

// The pass's very first query: "all pending areas, oldest request first". This index is the
// mechanism that lets ONE download satisfy every waiting area.
ProspectAreaSchema.index({ status: 1, lastRequestedAt: 1 });

// The coverage dashboard listing.
ProspectAreaSchema.index({ state: 1, kind: 1 });

export const ProspectArea: Model<IProspectArea> =
  models.ProspectArea || model<IProspectArea>("ProspectArea", ProspectAreaSchema);
