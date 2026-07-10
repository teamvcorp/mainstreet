import { Schema, model, models, type Model, type Types } from "mongoose";

export type MembershipTier = "listed" | "seller" | "featured" | "premium";

export interface BusinessAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface DayHours {
  open?: string; // "09:00"
  close?: string; // "17:00"
  closed?: boolean;
}

export interface IBusiness {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  townId: Types.ObjectId;
  name: string;
  slug: string; // /store/slug
  category?: string;
  description?: string;
  story?: string;
  logoUrl?: string;
  bannerUrl?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: BusinessAddress;
  lat?: number;
  lng?: number;
  hours?: Record<string, DayHours>;
  stripeAccountId?: string;
  stripeAccountActive: boolean;
  membershipTier: MembershipTier;
  membershipExpiresAt?: Date;
  /** Base catalog cap (10) + 50 per purchased extra block. Enforced on product create. */
  itemLimit: number;
  extraItemBlocks: number;
  shipsOnline: boolean;
  acceptsLocalPickup: boolean;
  isActive: boolean;
  /** Admin has confirmed this is a real local business (vs. spam/unverified). */
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    townId: { type: Schema.Types.ObjectId, ref: "Town", required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: String,
    description: String,
    story: String,
    logoUrl: String,
    bannerUrl: String,
    phone: String,
    email: String,
    website: String,
    address: { street: String, city: String, state: String, zip: String },
    lat: Number,
    lng: Number,
    hours: { type: Schema.Types.Mixed },
    stripeAccountId: String,
    stripeAccountActive: { type: Boolean, default: false },
    membershipTier: {
      type: String,
      enum: ["listed", "seller", "featured", "premium"],
      default: "listed",
    },
    membershipExpiresAt: Date,
    itemLimit: { type: Number, default: 10 },
    extraItemBlocks: { type: Number, default: 0 },
    shipsOnline: { type: Boolean, default: false },
    acceptsLocalPickup: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

BusinessSchema.index({ category: 1 });
BusinessSchema.index({ lat: 1, lng: 1 });

export const Business: Model<IBusiness> =
  models.Business || model<IBusiness>("Business", BusinessSchema);
