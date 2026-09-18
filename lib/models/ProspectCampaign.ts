import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * A tracked outreach campaign — email or postcard.
 *
 * THE AUDIENCE IS NOT STORED HERE. There is deliberately no `prospectIds` array: the
 * `ProspectCampaignRecipient` collection IS the audience snapshot, materialized once at
 * creation. That keeps this document small and bounded, and makes "resumable and
 * non-duplicating" fall out of a unique index rather than array surgery.
 */

export type CampaignType = "email" | "postcard";
export type CampaignStatus =
  | "draft"
  | "ready"
  | "sending"
  | "paused"
  | "sent"
  | "failed"
  | "canceled";

/**
 * The email body as ORDERED STRUCTURED CONTENT, never HTML.
 *
 * This is what lets an admin add a title, pictures and a flier while keeping the guarantee that
 * `dangerouslySetInnerHTML` appears nowhere in the email path: the admin supplies typed objects,
 * and `emails/ProspectOutreach.tsx` maps each block to a React Email component. There is no
 * HTML-injection path because no HTML is ever accepted.
 *
 * Validation lives in `schemas/prospects.ts` as a zod discriminated union:
 *   - `href`/`url` are https-only (no javascript:, no data:)
 *   - image `url` must be on the Vercel Blob host — an off-host image is an uncontrolled
 *     tracking pixel and a future broken image
 *   - `alt` is required; many clients block images by default, and a flier-only email with no
 *     alt text is a blank rectangle
 */
export type EmailBlock =
  | { type: "heading"; text: string; level?: 1 | 2 }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt: string; href?: string; width?: number }
  | { type: "button"; label: string; href: string }
  | { type: "divider" }
  | { type: "spacer"; size?: "sm" | "md" | "lg" };

export interface CampaignAudience {
  mode: "explicit" | "area";
  areaKeys: string[];
  filters?: {
    requireEmail?: boolean;
    excludeAgentAddress?: boolean;
    entityTypes?: string[];
  };
}

export interface IProspectCampaign {
  _id: Types.ObjectId;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  createdBy: Types.ObjectId;
  audience: CampaignAudience;

  // Email only.
  subject?: string;
  /** Hidden inbox preview snippet, distinct from the in-email heading block. */
  preheader?: string;
  blocks: EmailBlock[];
  replyTo?: string;

  // Postcard only.
  exportedAt?: Date;
  labelSheetPrintedAt?: Date;

  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProspectCampaignSchema = new Schema<IProspectCampaign>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["email", "postcard"], required: true },
    status: {
      type: String,
      enum: ["draft", "ready", "sending", "paused", "sent", "failed", "canceled"],
      default: "draft",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    audience: {
      mode: { type: String, enum: ["explicit", "area"], default: "area" },
      areaKeys: { type: [String], default: [] },
      filters: {
        requireEmail: Boolean,
        excludeAgentAddress: Boolean,
        entityTypes: [String],
      },
    },

    subject: String,
    preheader: String,
    // Mixed because the shape is a discriminated union; zod is the real gate at the API
    // boundary (see schemas/prospects.ts). Matches how Business.hours is stored. Mongoose does
    // not track in-place mutation of a Mixed path, which is fine: the composer always replaces
    // the whole array via $set rather than mutating elements.
    blocks: { type: Schema.Types.Mixed, default: [] },
    replyTo: String,

    exportedAt: Date,
    labelSheetPrintedAt: Date,

    totalCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true, collection: "prospectcampaigns" },
);

ProspectCampaignSchema.index({ status: 1, createdAt: -1 });
ProspectCampaignSchema.index({ type: 1, createdAt: -1 });

export const ProspectCampaign: Model<IProspectCampaign> =
  models.ProspectCampaign || model<IProspectCampaign>("ProspectCampaign", ProspectCampaignSchema);
