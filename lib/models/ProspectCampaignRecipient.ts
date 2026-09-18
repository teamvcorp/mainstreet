import { Schema, model, models, type Model, type Types } from "mongoose";
import type { ProspectAddress } from "@/lib/models/Prospect";

/**
 * One row per prospect per campaign. This collection IS the audience snapshot.
 *
 * THE SNAPSHOT IS FROZEN ON PURPOSE. `businessName` / `ownerName` / `email` / `address` are
 * copied here at materialization and never re-read from the prospect. A later edit to the
 * prospect — or the next ingest refresh — must not rewrite the record of what we actually sent.
 */

export type RecipientStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "skipped_suppressed"
  | "skipped_no_email"
  | "skipped_no_address"
  | "bounced";

export interface IProspectCampaignRecipient {
  _id: Types.ObjectId;
  campaignId: Types.ObjectId;
  prospectId: Types.ObjectId;

  // Frozen snapshot — see the header.
  businessName: string;
  ownerName?: string;
  email?: string;
  address?: ProspectAddress;

  status: RecipientStatus;
  attempts: number;
  providerMessageId?: string;
  error?: string;
  sentAt?: Date;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProspectCampaignRecipientSchema = new Schema<IProspectCampaignRecipient>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "ProspectCampaign", required: true },
    prospectId: { type: Schema.Types.ObjectId, ref: "Prospect", required: true },

    businessName: { type: String, required: true },
    ownerName: String,
    email: { type: String, lowercase: true, trim: true },
    address: {
      street1: String,
      street2: String,
      city: String,
      state: String,
      zip5: String,
      zip4: String,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "sending",
        "sent",
        "failed",
        "skipped_suppressed",
        "skipped_no_email",
        "skipped_no_address",
        "bounced",
      ],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    providerMessageId: String,
    error: String,
    sentAt: Date,
    unsubscribedAt: Date,
  },
  { timestamps: true, collection: "prospectcampaignrecipients" },
);

// THE NON-DUPLICATION GUARANTEE. A prospect appears at most once per campaign, so
// "rebuild audience" is an idempotent upsert and nobody ever gets two postcards.
ProspectCampaignRecipientSchema.index({ campaignId: 1, prospectId: 1 }, { unique: true });

// The resumable send loop: find({ campaignId, status: "pending" }).limit(batch).
// Also serves the status-count aggregation on the campaign detail page.
ProspectCampaignRecipientSchema.index({ campaignId: 1, status: 1 });

// "When did we last contact this business?" across all campaigns — the frequency-cap column.
ProspectCampaignRecipientSchema.index({ prospectId: 1, sentAt: -1 });

// Future Resend bounce/complaint webhook reconciliation. Cheap now, painful to backfill later.
ProspectCampaignRecipientSchema.index(
  { providerMessageId: 1 },
  { partialFilterExpression: { providerMessageId: { $type: "string" } } },
);

export const ProspectCampaignRecipient: Model<IProspectCampaignRecipient> =
  models.ProspectCampaignRecipient ||
  model<IProspectCampaignRecipient>(
    "ProspectCampaignRecipient",
    ProspectCampaignRecipientSchema,
  );
