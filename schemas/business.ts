import { z } from "zod";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const addressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(2).optional(),
  zip: z.string().max(10).optional(),
});

const dayHoursSchema = z.object({
  open: z.string().max(5).optional(), // "09:00"
  close: z.string().max(5).optional(),
  closed: z.boolean().optional(),
});
export const hoursSchema = z.record(z.string(), dayHoursSchema);

// Town is derived from the address (auto-created), so onboarding collects a
// location instead of picking from a list. City/state/zip are required for
// grouping; street is optional (some businesses are home-based / by appointment).
export const createBusinessSchema = z.object({
  name: z.string().min(2, "Business name is required").max(120),
  category: z.string().max(60).optional(),
  description: z.string().max(2000).optional(),
  street: z.string().max(200).optional(),
  city: z.string().min(2, "City is required").max(120),
  state: z.string().length(2, "Use the 2-letter state").transform((s) => s.toUpperCase()),
  zip: z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP"),
});
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export const updateBusinessSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.string().max(60).optional(),
  description: z.string().max(2000).optional(),
  story: z.string().max(6000).optional(),
  phone: z.string().max(30).optional(),
  email: z.email().optional().or(z.literal("")),
  website: z.url().optional().or(z.literal("")),
  address: addressSchema.optional(),
  hours: hoursSchema.optional(),
  logoUrl: z.url().optional().or(z.literal("")),
  bannerUrl: z.url().optional().or(z.literal("")),
  shipsOnline: z.boolean().optional(),
  acceptsLocalPickup: z.boolean().optional(),
});
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
