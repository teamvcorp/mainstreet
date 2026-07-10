import { connectToDatabase } from "@/lib/db";
import { Order, type IOrder } from "@/lib/models/Order";
import { OrderItem, type IOrderItem } from "@/lib/models/OrderItem";
import { toOrderDTO } from "@/lib/dto";

/**
 * Seller order views. Uses toOrderDTO so confidential carrier cost / margin are
 * never included (also select:false at the schema layer — defense in depth).
 */
export async function getSellerOrders(businessId: string) {
  await connectToDatabase();
  const orders = await Order.find({ businessId })
    .sort({ createdAt: -1 })
    .lean<(IOrder & { _id: { toString(): string } })[]>();
  return orders.map(toOrderDTO);
}

export async function getSellerOrder(orderId: string, businessId: string) {
  await connectToDatabase();
  const order = await Order.findOne({ _id: orderId, businessId }).lean<
    IOrder & { _id: { toString(): string } }
  >();
  if (!order) return null;
  const items = await OrderItem.find({ orderId }).lean<IOrderItem[]>();
  return {
    ...toOrderDTO(order),
    items: items.map((it) => ({
      id: it._id.toString(),
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      snapshot: it.productSnapshot as { name?: string; images?: string[] } | undefined,
    })),
  };
}
