import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IOrderItem {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  productId: Types.ObjectId;
  quantity: number;
  unitPriceCents: number; // snapshot at time of purchase
  productSnapshot?: Record<string, unknown>; // full product data at purchase time
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true },
    productSnapshot: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const OrderItem: Model<IOrderItem> =
  models.OrderItem || model<IOrderItem>("OrderItem", OrderItemSchema);
