import { Schema, model, models, type Model, type Types } from "mongoose";
import type { QualityReason } from "@/lib/prospects/quality";

/**
 * A business we might mail — sourced from the Iowa SOS registry, or entered/imported by an
 * admin. NOT a MainStreet member; see `Business` for that.
 *
 * FIELD OWNERSHIP IS THE MOST IMPORTANT THING IN THIS FILE.
 * The ingest pass writes SOURCE-OWNED fields with `$set` on every run, and ADMIN-OWNED fields
 * with `$setOnInsert` only. On a re-run the document already exists, so the admin-owned fields
 * are never named in the update and cannot be touched — an admin's typed-in email, notes, and
 * opt-out survive every refresh. Getting this wrong silently destroys data with no error.
 * The two field lists live in `lib/prospects/ingest.ts`; keep them in sync with this schema.
 */

export type ProspectSource = "ia_sos" | "manual" | "import";
export type ProspectAddressSource = "principal_office" | "registered_agent";
export type ProspectStatus =
  | "new"
  | "queued"
  | "contacted"
  | "responded"
  | "converted"
  | "bad_data"
  | "excluded";

export interface ProspectAddress {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip5?: string;
  zip4?: string;
}

export interface IProspect {
  _id: Types.ObjectId;

  // ── SOURCE-OWNED ──────────────────────────────────────────────────────────
  source: ProspectSource;
  /** `corp_number` for ia_sos; a uuid for manual records. Unique with `source`. */
  sourceId: string;
  sourceFetchedAt?: Date;
  sourceEffectiveDate?: Date;
  /** e.g. "Domestic Limited Liability Company" — display case. */
  entityType?: string;

  businessName: string;
  /** Normalized lookup key. Queries touch THIS, never `businessName`. */
  businessNameKey: string;

  /** Raw registered agent, display-cased. Always preserved, even when commercial. */
  agentName?: string;
  agentIsCommercial: boolean;
  /** Only set when the agent looks like a natural person, or entered manually. */
  ownerName?: string;
  ownerNameSource?: "registered_agent" | "manual";

  address: ProspectAddress;
  addressSource: ProspectAddressSource;
  /** Mirror of `addressSource === "registered_agent"` — drives the amber UI badge. */
  addressIsAgent: boolean;
  /** Normalized "STREET|CITY|ST|ZIP5" for postal dedupe + return-to-sender suppression. */
  addressKey?: string;

  /** Denormalized lookup keys. `cityKey` is byte-identical to the matching `Town.slug`. */
  cityKey: string;
  zip5?: string;
  state: string;
  lat?: number;
  lng?: number;
  townId?: Types.ObjectId;

  qualityOk: boolean;
  mailable: boolean;
  emailable: boolean;
  qualityReasons: QualityReason[];

  // ── ADMIN-OWNED (ingest must never $set these) ────────────────────────────
  email?: string;
  emailSource?: "manual" | "import";
  emailAddedAt?: Date;
  status: ProspectStatus;
  /** Cached opt-out mirror. `ProspectOptOut` is the authority; this is a query optimization. */
  suppressed: boolean;
  lastCampaignAt?: Date;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ProspectSchema = new Schema<IProspect>(
  {
    source: { type: String, enum: ["ia_sos", "manual", "import"], required: true },
    sourceId: { type: String, required: true },
    sourceFetchedAt: Date,
    sourceEffectiveDate: Date,
    entityType: String,

    businessName: { type: String, required: true },
    businessNameKey: { type: String, required: true },

    agentName: String,
    agentIsCommercial: { type: Boolean, default: false },
    ownerName: String,
    ownerNameSource: { type: String, enum: ["registered_agent", "manual"] },

    address: {
      street1: String,
      street2: String,
      city: String,
      state: String,
      zip5: String,
      zip4: String,
    },
    addressSource: {
      type: String,
      enum: ["principal_office", "registered_agent"],
      required: true,
      default: "principal_office",
    },
    addressIsAgent: { type: Boolean, default: false },
    addressKey: String,

    cityKey: { type: String, required: true },
    zip5: String,
    state: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    lat: Number,
    lng: Number,
    townId: { type: Schema.Types.ObjectId, ref: "Town" },

    qualityOk: { type: Boolean, default: false },
    mailable: { type: Boolean, default: false },
    emailable: { type: Boolean, default: false },
    qualityReasons: { type: [String], default: [] },

    email: { type: String, lowercase: true, trim: true },
    emailSource: { type: String, enum: ["manual", "import"] },
    emailAddedAt: Date,
    status: {
      type: String,
      enum: ["new", "queued", "contacted", "responded", "converted", "bad_data", "excluded"],
      default: "new",
    },
    suppressed: { type: Boolean, default: false },
    lastCampaignAt: Date,
    notes: String,
  },
  { timestamps: true, collection: "prospects" },
);

// THE dedupe key. Every ingest pass upserts on it, so re-running 50 times yields the same row
// count. REQUIRED FOR CORRECTNESS, not perf: `upsert` inside an unordered bulkWrite will
// happily create duplicate documents when two upserts for the same key race without it.
ProspectSchema.index({ source: 1, sourceId: 1 }, { unique: true });

// The city lookup. Equality on the high-selectivity key, then two low-cardinality flags, then
// the sort key — so the default admin query is one index scan with no in-memory sort.
ProspectSchema.index({ cityKey: 1, qualityOk: 1, suppressed: 1, businessNameKey: 1 });

// The ZIP lookup, same shape. Separate index (not a prefix of the above) because city and ZIP
// are independent entry points.
ProspectSchema.index({ zip5: 1, qualityOk: 1, suppressed: 1, businessNameKey: 1 });

// Suppression propagation and CSV-import matching. Partial so the ~99% of rows with no email
// cost nothing. Deliberately NOT unique — two branches of one company can share a mailbox.
ProspectSchema.index({ email: 1 }, { partialFilterExpression: { email: { $type: "string" } } });

// Dedupe for manual/CSV rows that have no corp number, plus in-city name search.
ProspectSchema.index({ businessNameKey: 1, cityKey: 1 });

// Admin worklists ("everything contacted but not responded").
ProspectSchema.index({ status: 1, updatedAt: -1 });

export const Prospect: Model<IProspect> =
  models.Prospect || model<IProspect>("Prospect", ProspectSchema);
