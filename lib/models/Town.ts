import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ITown {
  _id: Types.ObjectId;
  name: string;
  slug: string; // /town/royal-america
  state: string; // 2-letter
  county?: string;
  lat?: number;
  lng?: number;
  heroImageUrl?: string;
  tagline?: string;
  spotlightBusinessId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TownSchema = new Schema<ITown>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    state: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    county: String,
    lat: Number,
    lng: Number,
    heroImageUrl: String,
    tagline: String,
    spotlightBusinessId: { type: Schema.Types.ObjectId, ref: "Business" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Geo index enables "nearby towns" and radius queries.
TownSchema.index({ lat: 1, lng: 1 });
TownSchema.index({ state: 1 });

export const Town: Model<ITown> = models.Town || model<ITown>("Town", TownSchema);
