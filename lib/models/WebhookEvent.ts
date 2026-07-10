import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Idempotency ledger for incoming webhooks (Stripe, EasyPost).
 * Before processing an event we insert its provider+eventId; the unique index
 * makes a duplicate delivery fail the insert, so we can safely no-op retries.
 */
export interface IWebhookEvent {
  _id: Types.ObjectId;
  provider: "stripe" | "easypost";
  eventId: string;
  processedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>({
  provider: { type: String, enum: ["stripe", "easypost"], required: true },
  eventId: { type: String, required: true },
  processedAt: { type: Date, default: () => new Date() },
});

WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const WebhookEvent: Model<IWebhookEvent> =
  models.WebhookEvent || model<IWebhookEvent>("WebhookEvent", WebhookEventSchema);
