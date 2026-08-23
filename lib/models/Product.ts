import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ProductDimensions {
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
}

/** One author-defined option axis, e.g. { name: "Size", values: ["S","M","L"] }. */
export interface IProductOptionType {
  name: string;
  values: string[];
}

/**
 * A single sellable combination (e.g. Size=M, Color=Blue). Each variant carries its
 * OWN price/stock/weight — when a product has variants these are authoritative and the
 * product-level price/inventory/weight are only the defaults used for no-variant products.
 * `_id` is the stable identity referenced by cart lines and order items.
 */
export interface IProductVariant {
  _id: Types.ObjectId;
  options: { name: string; value: string }[]; // one entry per optionType, order-preserving
  priceCents: number;
  inventoryQty: number;
  trackInventory: boolean;
  weightOz?: number; // falls back to product.weightOz when unset
  sku?: string;
  isActive: boolean; // deactivate a combination that doesn't exist
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
  optionTypes: IProductOptionType[];
  variants: IProductVariant[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<IProductVariant>(
  {
    options: {
      type: [{ _id: false, name: { type: String, required: true }, value: { type: String, required: true } }],
      default: [],
    },
    priceCents: { type: Number, required: true, min: 0 },
    inventoryQty: { type: Number, default: 0, min: 0 },
    trackInventory: { type: Boolean, default: true },
    weightOz: { type: Number, min: 0 },
    sku: String,
    isActive: { type: Boolean, default: true },
  },
  { _id: true }, // subdoc _id is the stable identity used by cart/order references
);

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
    optionTypes: {
      type: [{ _id: false, name: { type: String, required: true }, values: { type: [String], default: [] } }],
      default: [],
    },
    variants: { type: [VariantSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Product slug is unique within a business (not globally).
ProductSchema.index({ businessId: 1, slug: 1 }, { unique: true });
ProductSchema.index({ category: 1 });

export const Product: Model<IProduct> =
  models.Product || model<IProduct>("Product", ProductSchema);
