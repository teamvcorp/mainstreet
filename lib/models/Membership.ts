import { Schema, model, models, type Model, type Types } from "mongoose";
import type { MembershipTier } from "./Business";

export interface IMembership {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  stripeSubscriptionId?: string;
  tier: MembershipTier;
  priceCents: number;
  extraItemBlocks: number; // each = +50 items, $5/mo
  startedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<IMembership>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    stripeSubscriptionId: { type: String, unique: true, sparse: true },
    tier: {
      type: String,
      enum: ["listed", "seller", "featured", "premium"],
      default: "seller",
    },
    priceCents: { type: Number, default: 0 },
    extraItemBlocks: { type: Number, default: 0 },
    startedAt: Date,
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Membership: Model<IMembership> =
  models.Membership || model<IMembership>("Membership", MembershipSchema);
