import { z } from "zod";

const dimensionsSchema = z
  .object({
    lengthIn: z.number().positive().max(200).optional(),
    widthIn: z.number().positive().max(200).optional(),
    heightIn: z.number().positive().max(200).optional(),
  })
  .optional();

export const MAX_OPTION_TYPES = 3;
export const MAX_OPTION_VALUES = 50;
export const MAX_VARIANTS = 100;

/** An author-defined option axis, e.g. Size: [S, M, L]. */
export const optionTypeSchema = z.object({
  name: z.string().min(1, "Option name is required").max(40),
  values: z.array(z.string().min(1).max(60)).min(1, "Add at least one value").max(MAX_OPTION_VALUES),
});

/** A generated combination row. `id` is the existing subdoc _id on edits (merge key). */
export const variantSchema = z.object({
  id: z.string().max(40).optional(),
  options: z
    .array(z.object({ name: z.string().min(1).max(40), value: z.string().min(1).max(60) }))
    .min(1)
    .max(MAX_OPTION_TYPES),
  priceCents: z.number().int().min(0).max(100_000_000),
  inventoryQty: z.number().int().min(0).default(0),
  trackInventory: z.boolean().default(true),
  weightOz: z.number().min(0).max(10_000).optional(),
  sku: z.string().max(80).optional(),
  isActive: z.boolean().default(true),
});

export const createProductSchema = z
  .object({
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
    optionTypes: z.array(optionTypeSchema).max(MAX_OPTION_TYPES).default([]),
    variants: z.array(variantSchema).max(MAX_VARIANTS).default([]),
  })
  .superRefine((data, ctx) => {
    const types = data.optionTypes ?? [];
    const variants = data.variants ?? [];
    if (variants.length && !types.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Define option types before adding variants." });
      return;
    }
    if (!variants.length) return;

    const typeNames = types.map((t) => t.name);
    const valuesByName = new Map(types.map((t) => [t.name, new Set(t.values)]));
    const seen = new Set<string>();

    variants.forEach((v, i) => {
      // Every variant must specify exactly the declared option-type names.
      const vNames = v.options.map((o) => o.name);
      const sameNames =
        vNames.length === typeNames.length && typeNames.every((n) => vNames.includes(n));
      if (!sameNames) {
        ctx.addIssue({ code: "custom", path: ["variants", i], message: "Variant options don't match the option types." });
        return;
      }
      // Each value must be one the option type declares.
      for (const o of v.options) {
        if (!valuesByName.get(o.name)?.has(o.value)) {
          ctx.addIssue({ code: "custom", path: ["variants", i], message: `"${o.value}" isn't a value of "${o.name}".` });
        }
      }
      // No duplicate combination (order-independent signature).
      const sig = [...v.options].sort((a, b) => a.name.localeCompare(b.name)).map((o) => `${o.name}=${o.value}`).join("|");
      if (seen.has(sig)) {
        ctx.addIssue({ code: "custom", path: ["variants", i], message: "Duplicate variant combination." });
      }
      seen.add(sig);
    });
  });
export type CreateProductInput = z.infer<typeof createProductSchema>;

// createProductSchema is a ZodEffects (has .superRefine), so it has no .partial();
// declare the PATCH shape explicitly with every field optional + the same refine.
export const updateProductSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(4000).optional(),
    priceCents: z.number().int().min(0).max(100_000_000).optional(),
    compareAtPriceCents: z.number().int().min(0).max(100_000_000).optional(),
    sku: z.string().max(80).optional(),
    inventoryQty: z.number().int().min(0).optional(),
    trackInventory: z.boolean().optional(),
    weightOz: z.number().min(0).max(10_000).optional(),
    dimensions: dimensionsSchema,
    images: z.array(z.url()).max(8).optional(),
    category: z.string().max(60).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
    optionTypes: z.array(optionTypeSchema).max(MAX_OPTION_TYPES).optional(),
    variants: z.array(variantSchema).max(MAX_VARIANTS).optional(),
  })
  .superRefine((data, ctx) => {
    // Only validate the option/variant relationship when both are being set together.
    if (data.variants === undefined && data.optionTypes === undefined) return;
    const types = data.optionTypes ?? [];
    const variants = data.variants ?? [];
    if (!variants.length) return;
    if (!types.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Define option types before adding variants." });
      return;
    }
    const typeNames = types.map((t) => t.name);
    const valuesByName = new Map(types.map((t) => [t.name, new Set(t.values)]));
    const seen = new Set<string>();
    variants.forEach((v, i) => {
      const vNames = v.options.map((o) => o.name);
      const sameNames = vNames.length === typeNames.length && typeNames.every((n) => vNames.includes(n));
      if (!sameNames) {
        ctx.addIssue({ code: "custom", path: ["variants", i], message: "Variant options don't match the option types." });
        return;
      }
      for (const o of v.options) {
        if (!valuesByName.get(o.name)?.has(o.value)) {
          ctx.addIssue({ code: "custom", path: ["variants", i], message: `"${o.value}" isn't a value of "${o.name}".` });
        }
      }
      const sig = [...v.options].sort((a, b) => a.name.localeCompare(b.name)).map((o) => `${o.name}=${o.value}`).join("|");
      if (seen.has(sig)) ctx.addIssue({ code: "custom", path: ["variants", i], message: "Duplicate variant combination." });
      seen.add(sig);
    });
  });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
