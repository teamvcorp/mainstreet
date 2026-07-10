import { z } from "zod";
import { objectId } from "@/schemas/business";

export const shipAddressSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  street: z.string().min(2, "Street is required").max(200),
  city: z.string().min(2, "City is required").max(120),
  state: z.string().length(2, "2-letter state"),
  zip: z.string().regex(/^\d{5}$/, "5-digit ZIP"),
  phone: z.string().min(7, "Phone is required").max(30),
});
export type ShipAddressInput = z.infer<typeof shipAddressSchema>;

export const cartLineSchema = z.object({
  productId: objectId,
  businessId: objectId,
  quantity: z.number().int().min(1).max(99),
});

export const ratesRequestSchema = z.object({
  toAddress: shipAddressSchema,
  items: z.array(cartLineSchema).min(1).max(100),
});

export const shippingSelectionSchema = z.object({
  mode: z.enum(["ship", "pickup"]),
  carrier: z.string().max(40).optional(),
  service: z.string().max(60).optional(),
});

export const createIntentSchema = z.object({
  toAddress: shipAddressSchema,
  items: z.array(cartLineSchema).min(1).max(100),
  // keyed by businessId
  selections: z.record(z.string(), shippingSelectionSchema),
});
export type CreateIntentInput = z.infer<typeof createIntentSchema>;
