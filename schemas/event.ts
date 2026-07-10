import { z } from "zod";
import { EVENT_CATEGORIES } from "@/lib/event-categories";

// Business contact is pulled from the business record — NOT collected here.
// Sellers only provide event-specific fields.
export const createEventSchema = z.object({
  title: z.string().min(3, "Event name is required").max(140),
  description: z.string().max(4000).optional(),
  category: z.enum(EVENT_CATEGORIES),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  locationName: z.string().max(160).optional(),
  imageUrl: z.url().optional().or(z.literal("")),
  isFree: z.boolean().default(true),
  ticketUrl: z.url().optional().or(z.literal("")),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

// Per requirement: after creation only the event NAME and DETAILS may change.
export const updateEventSchema = z.object({
  title: z.string().min(3).max(140).optional(),
  description: z.string().max(4000).optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
