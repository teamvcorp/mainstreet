import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ProductDimensions {
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
}

export interface IProduct {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  name: string;
  slug: string; // unique per business, used in /store/[slug]/[product]
  description?: string;
  priceCents: number;
  compareAtPriceCents?: number;
  sku?: string;
  inventoryQty: number;
  trackInventory: boolean;
  weightOz?: number; // for shipping rate calc
  dimensions?: ProductDimensions;
  images: string[];
  category?: string;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: String,
    priceCents: { type: Number, required: true, min: 0 },
    compareAtPriceCents: { type: Number, min: 0 },
    sku: String,
    inventoryQty: { type: Number, default: 0, min: 0 },
    trackInventory: { type: Boolean, default: true },
    weightOz: { type: Number, min: 0 },
    dimensions: { lengthIn: Number, widthIn: Number, heightIn: Number },
    images: { type: [String], default: [] },
    category: String,
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Product slug is unique within a business (not globally).
ProductSchema.index({ businessId: 1, slug: 1 }, { unique: true });
ProductSchema.index({ category: 1 });

export const Product: Model<IProduct> =
  models.Product || model<IProduct>("Product", ProductSchema);
