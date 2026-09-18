import { z } from "zod";

/**
 * Validation for the prospects / mailing-list feature.
 *
 * Everything an admin sends passes through here before it reaches a query or a template.
 * Two properties this buys us:
 *   - NoSQL operator injection is impossible: `z.string()` rejects objects, so `{"$ne": null}`
 *     can never reach a Mongo filter.
 *   - The email body is structured data, so no HTML ever enters the send path.
 */

// ─── Areas ──────────────────────────────────────────────────────────────────

export const requestAreaSchema = z.object({
  /** "Storm Lake", "Storm Lake, IA", "51601" — parsed by parseAreaQuery(). */
  query: z.string().min(2).max(120),
});
export type RequestAreaInput = z.infer<typeof requestAreaSchema>;

export const areaActionSchema = z.object({
  action: z.enum(["requeue"]),
});

// ─── Prospect edits ─────────────────────────────────────────────────────────

export const updateProspectSchema = z.object({
  email: z.email().max(254).optional().or(z.literal("")),
  ownerName: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  status: z
    .enum(["new", "queued", "contacted", "responded", "converted", "bad_data", "excluded"])
    .optional(),
});
export type UpdateProspectInput = z.infer<typeof updateProspectSchema>;

// ─── Email blocks ───────────────────────────────────────────────────────────

/**
 * Images must live on our own Vercel Blob store.
 *
 * An off-host image in a blast is a tracking pixel we do not control and a broken image the day
 * that host disappears. `isBlobUrl` is enforced here rather than in the component, so a bad URL
 * can never be persisted in the first place.
 */
const httpsUrl = z.url().refine((u) => u.startsWith("https://"), {
  message: "Must be an https URL",
});

const blobUrl = httpsUrl.refine(
  (u) => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(u),
  { message: "Images must be uploaded to this site (Vercel Blob), not linked from elsewhere" },
);

export const emailBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string().min(1).max(200), level: z.union([z.literal(1), z.literal(2)]).optional() }),
  z.object({ type: z.literal("text"), text: z.string().min(1).max(5000) }),
  z.object({
    type: z.literal("image"),
    url: blobUrl,
    // Required: many clients block images by default, and a flier-only email with no alt text
    // is a blank rectangle.
    alt: z.string().min(1).max(200),
    href: httpsUrl.optional(),
    width: z.number().int().min(80).max(600).optional(),
  }),
  z.object({ type: z.literal("button"), label: z.string().min(1).max(60), href: httpsUrl }),
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("spacer"), size: z.enum(["sm", "md", "lg"]).optional() }),
]);
export type EmailBlockInput = z.infer<typeof emailBlockSchema>;

/** Cap total blocks so a paste cannot produce a multi-megabyte email. */
export const emailBlocksSchema = z.array(emailBlockSchema).max(40);

/** CAN-SPAM: the subject line must not be deceptive. */
const subjectSchema = z
  .string()
  .min(2)
  .max(200)
  .refine((s) => !/^\s*(re|fw|fwd)\s*:/i.test(s), {
    message: "Subject may not fake a reply or forward",
  })
  .refine((s) => !(s.length > 12 && s === s.toUpperCase()), {
    message: "Subject may not be all capitals",
  })
  .refine((s) => !/!{2,}/.test(s), { message: "Subject may not use repeated exclamation marks" });

// ─── Campaigns ──────────────────────────────────────────────────────────────

const audienceBase = {
  name: z.string().min(2).max(120),
  areaKeys: z.array(z.string().max(80)).max(50).optional(),
  prospectIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(2000).optional(),
  excludeAgentAddress: z.boolean().default(false),
};

export const createCampaignSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("postcard"),
    ...audienceBase,
  }),
  z.object({
    type: z.literal("email"),
    ...audienceBase,
    subject: subjectSchema,
    preheader: z.string().max(200).optional(),
    blocks: emailBlocksSchema,
    replyTo: z.email().optional(),
  }),
]);
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const campaignActionSchema = z.object({
  action: z.enum(["send", "pause", "resume", "cancel", "rebuild_audience", "retry_failed"]),
});

export const sendBatchSchema = z.object({
  batchSize: z.number().int().min(1).max(200).default(100),
});

// ─── Unsubscribe ────────────────────────────────────────────────────────────

export const unsubscribeSchema = z.object({
  t: z.string().min(10).max(400),
});

// ─── Opt-out ────────────────────────────────────────────────────────────────

export const optOutSchema = z.object({
  email: z.email().max(254).optional(),
  prospectId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  channel: z.enum(["email", "postal", "all"]).default("all"),
  reason: z.enum(["unsubscribe_link", "reply", "return_to_sender", "manual", "complaint"]).default("manual"),
});
