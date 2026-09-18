import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Permanent suppression list. An entry here means we never contact that address again.
 *
 * THERE IS NO TTL INDEX ON THIS COLLECTION, AND THERE NEVER WILL BE.
 * CAN-SPAM makes an opt-out permanent, and a TTL here would silently re-enable mailing someone
 * who explicitly asked us to stop. `updatedAt` is disabled too: these records are immutable.
 *
 * `Prospect.suppressed` is a cached mirror of this collection for cheap list filtering. THIS
 * collection is the authority, and the send path re-checks it per recipient per batch — which
 * is what makes a mid-campaign unsubscribe actually honored rather than honored next time.
 */

export type OptOutChannel = "email" | "postal" | "all";
export type OptOutKeyKind = "email" | "address";
export type OptOutReason =
  | "unsubscribe_link"
  | "reply"
  | "return_to_sender"
  | "manual"
  | "complaint";

export interface IProspectOptOut {
  _id: Types.ObjectId;
  channel: OptOutChannel;
  keyKind: OptOutKeyKind;
  /**
   * sha256 of the NORMALIZED key (lowercased email, or the normalized address key).
   * Hashing gives a stable lookup that cannot drift with string formatting, and means postal
   * addresses need not be stored in full. For emails we also keep the plaintext below, so this
   * is a normalization device rather than a privacy claim — better to be honest about that.
   */
  keyHash: string;
  email?: string;
  /** Short human hint for postal entries, e.g. "312 Carter St, Shenandoah". */
  label?: string;
  reason: OptOutReason;
  campaignId?: Types.ObjectId;
  prospectId?: Types.ObjectId;
  createdAt: Date;
}

const ProspectOptOutSchema = new Schema<IProspectOptOut>(
  {
    channel: { type: String, enum: ["email", "postal", "all"], required: true },
    keyKind: { type: String, enum: ["email", "address"], required: true },
    keyHash: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    label: String,
    reason: {
      type: String,
      enum: ["unsubscribe_link", "reply", "return_to_sender", "manual", "complaint"],
      required: true,
    },
    campaignId: { type: Schema.Types.ObjectId, ref: "ProspectCampaign" },
    prospectId: { type: Schema.Types.ObjectId, ref: "Prospect" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "prospectoptouts" },
);

// O(1) suppression check on the hot send path, and an idempotent insert: a double-clicked
// unsubscribe is a swallowed E11000 rather than an error the recipient sees.
ProspectOptOutSchema.index({ keyKind: 1, keyHash: 1 }, { unique: true });
ProspectOptOutSchema.index({ createdAt: -1 });

export const ProspectOptOut: Model<IProspectOptOut> =
  models.ProspectOptOut || model<IProspectOptOut>("ProspectOptOut", ProspectOptOutSchema);
