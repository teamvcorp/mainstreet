import { z } from "zod";

const dimensionsSchema = z
  .object({
    lengthIn: z.number().positive().max(200).optional(),
    widthIn: z.number().positive().max(200).optional(),
    heightIn: z.number().positive().max(200).optional(),
  })
  .optional();

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  description: z.string().max(4000).optional(),
  priceCents: z.number().int().min(0).max(100_000_000),
  compareAtPriceCents: z.number().int().min(0).max(100_000_000).optional(),
  sku: z.string().max(80).optional(),
  inventoryQty: z.number().int().min(0).default(0),
  trackInventory: z.boolean().default(true),
  weightOz: z.number().min(0).max(10_000).optional(),
  dimensions: dimensionsSchema,
  images: z.array(z.url()).max(8).default([]),
  category: z.string().max(60).optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
