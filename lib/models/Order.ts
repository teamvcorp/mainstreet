import { Schema, model, models, type Model, type Types } from "mongoose";

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type FulfillmentType = "ship" | "pickup";

export interface OrderShippingAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
}

export interface IOrder {
  _id: Types.ObjectId;
  buyerId: Types.ObjectId;
  businessId: Types.ObjectId; // one order per business (multi-store carts split)
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  subtotalCents: number;
  shippingCents: number; // what the consumer paid (already marked up)
  /** CONFIDENTIAL — what we pay the carrier. select:false; admin-only. */
  carrierCostCents?: number;
  /** CONFIDENTIAL — our shipping profit. select:false; admin-only. */
  platformFeeCents?: number;
  taxCents: number;
  totalCents: number;
  shippingAddress?: OrderShippingAddress;
  easypostRateId?: string;
  easypostShipmentId?: string;
  carrier?: string;
  service?: string;
  trackingNumber?: string;
  labelUrl?: string; // attached by admin / SL Pack & Ship after fulfillment
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    fulfillmentType: { type: String, enum: ["ship", "pickup"], required: true },
    // NOT unique: one PaymentIntent can cover multiple sub-orders (multi-seller cart).
    stripePaymentIntentId: { type: String, index: true },
    stripeTransferId: String,
    subtotalCents: { type: Number, required: true },
    shippingCents: { type: Number, default: 0 },
    // CONFIDENTIAL fields — never returned to sellers/buyers. Guarded two ways:
    // schema-level select:false here, plus DTO whitelists in lib/dto.
    carrierCostCents: { type: Number, select: false },
    platformFeeCents: { type: Number, select: false },
    taxCents: { type: Number, default: 0 },
    totalCents: { type: Number, required: true },
    shippingAddress: {
      name: String,
      street: String,
      city: String,
      state: String,
      zip: String,
      phone: String,
    },
    easypostRateId: String,
    easypostShipmentId: String,
    carrier: String,
    service: String,
    trackingNumber: String,
    labelUrl: String,
    shippedAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true },
);

export const Order: Model<IOrder> = models.Order || model<IOrder>("Order", OrderSchema);
