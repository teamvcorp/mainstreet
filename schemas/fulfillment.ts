import { z } from "zod";

/** Admin/SL Pack & Ship fulfillment update on an order. */
export const fulfillOrderSchema = z.object({
  action: z.enum(["ship", "deliver", "processing"]),
  trackingNumber: z.string().max(80).optional(),
  carrier: z.string().max(40).optional(),
  service: z.string().max(60).optional(),
  labelUrl: z.url().optional().or(z.literal("")),
});
export type FulfillOrderInput = z.infer<typeof fulfillOrderSchema>;
