import { Schema, model, models, type Model, type Types } from "mongoose";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat] — GeoJSON order
}

export interface ITown {
  _id: Types.ObjectId;
  name: string;
  slug: string; // /town/royal-america
  state: string; // 2-letter
  county?: string;
  lat?: number;
  lng?: number;
  /** GeoJSON mirror of lat/lng — enables $geoNear radius queries (2dsphere). */
  location?: GeoPoint;
  heroImageUrl?: string;
  tagline?: string;
  population?: number;
  /** Zip codes seen for businesses in this town — logical grouping metadata. */
  zips: string[];
  /** Auto-created from a business address vs. curated by an admin. */
  autoCreated: boolean;
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
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] }, // [lng, lat]
    },
    heroImageUrl: String,
    tagline: String,
    population: Number,
    zips: { type: [String], default: [] },
    autoCreated: { type: Boolean, default: false },
    spotlightBusinessId: { type: Schema.Types.ObjectId, ref: "Business" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Keep the GeoJSON point in sync with lat/lng so callers only set lat/lng.
// Sync hook (no `next` arg) — Mongoose auto-advances when nothing is returned.
TownSchema.pre("validate", function syncLocation() {
  if (typeof this.lat === "number" && typeof this.lng === "number") {
    this.location = { type: "Point", coordinates: [this.lng, this.lat] };
  }
});

// 2dsphere powers radius/"near me" queries. Sparse for towns without coords.
TownSchema.index({ location: "2dsphere" });
TownSchema.index({ state: 1 });

export const Town: Model<ITown> = models.Town || model<ITown>("Town", TownSchema);
