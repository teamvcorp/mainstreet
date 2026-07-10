import { z } from "zod";
import { objectId } from "@/schemas/business";

// No-auth submission (lower friction = more leads). Kept small + validated.
export const createSuggestionSchema = z.object({
  businessName: z.string().min(2, "Business name is required").max(160),
  townId: objectId.optional(),
  townSlug: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
  website: z.url().optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
  searchQuery: z.string().max(200).optional(),
});
export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
