import { Schema, model, models, type Model, type Types } from "mongoose";
import type { ShipMode } from "@/lib/models/Business";

export interface TrackingEvent {
  status: string;
  message?: string;
  datetime?: Date;
  location?: string;
}

/**
 * A shipment created through the Storm Lake Pack & Ship Partner API.
 *
 * Retail is the only figure the partner ever reports (contract §8), so the old
 * `carrierRateCents` / `marginCents` fields are gone — we cannot populate them, and
 * the shipping spread now belongs to Storm Lake rather than MainStreet. Keeping
 * unfillable "confidential" columns would only imply we track a margin we don't.
 */
export interface IShipment {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  /** "shp_…" — the partner's id for this shipment. */
  partnerShipmentId?: string;
  /** The single-use quote this shipment was bought against. */
  quoteId?: string;
  mode?: ShipMode;
  carrier?: string;
  service?: string;
  trackingNumber?: string;
  /**
   * The partner emails labels rather than returning bytes, so this is normally
   * empty. Retained for admin-uploaded labels (the pre-API fulfillment flow).
   */
  labelUrl?: string;
  /** self_ship only — where the label was emailed. */
  labelEmailedTo?: string;
  /** What the buyer paid for shipping, in cents. Retail; no markup. */
  consumerRateCents: number;
  /** Partner status: "shipped" | "awaiting_pack". */
  status?: string;
  trackingEvents: TrackingEvent[];
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentSchema = new Schema<IShipment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    partnerShipmentId: { type: String, index: true },
    quoteId: String,
    mode: { type: String, enum: ["self_ship", "pickup_pack"] },
    carrier: String,
    service: String,
    trackingNumber: String,
    labelUrl: String,
    labelEmailedTo: String,
    consumerRateCents: { type: Number, default: 0 },
    status: String,
    trackingEvents: { type: [Object], default: [] },
    estimatedDelivery: Date,
    deliveredAt: Date,
  },
  { timestamps: true },
);

export const Shipment: Model<IShipment> =
  models.Shipment || model<IShipment>("Shipment", ShipmentSchema);
