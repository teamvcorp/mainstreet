import { Schema, model, models, type Model, type Types } from "mongoose";

export interface TrackingEvent {
  status: string;
  message?: string;
  datetime?: Date;
  location?: string;
}

export interface IShipment {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  carrier?: string;
  service?: string; // 'Priority', 'Ground', etc.
  trackingNumber?: string;
  labelUrl?: string; // PDF/ZPL, stored in Vercel Blob
  consumerRateCents: number; // what the buyer paid (marked up)
  /** CONFIDENTIAL — our carrier cost. select:false; admin-only. */
  carrierRateCents?: number;
  /** CONFIDENTIAL — computed margin. select:false; admin-only. */
  marginCents?: number;
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
    carrier: String,
    service: String,
    trackingNumber: String,
    labelUrl: String,
    consumerRateCents: { type: Number, default: 0 },
    carrierRateCents: { type: Number, select: false },
    marginCents: { type: Number, select: false },
    status: String,
    trackingEvents: { type: [Object], default: [] },
    estimatedDelivery: Date,
    deliveredAt: Date,
  },
  { timestamps: true },
);

export const Shipment: Model<IShipment> =
  models.Shipment || model<IShipment>("Shipment", ShipmentSchema);
