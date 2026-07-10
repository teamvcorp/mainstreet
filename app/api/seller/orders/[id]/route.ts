import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { Business } from "@/lib/models/Business";
import { errorResponse } from "@/lib/api";

const bodySchema = z.object({ action: z.enum(["picked_up"]) });

/** Seller marks a LOCAL PICKUP order as fulfilled (picked up). Owner-only. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/seller/orders/[id]">) {
  try {
    const user = await requireRole(["seller", "admin"]);
    const { id } = await ctx.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    await connectToDatabase();
    const order = await Order.findById(id);
    if (!order) throw new Error("NOT_FOUND");

    const biz = await Business.findById(order.businessId).select("ownerId");
    if (!biz) throw new Error("NOT_FOUND");
    if (biz.ownerId.toString() !== user.id && user.role !== "admin") throw new Error("FORBIDDEN");

    if (order.fulfillmentType !== "pickup") {
      return NextResponse.json({ error: "Only pickup orders can be marked picked up here." }, { status: 400 });
    }

    order.status = "delivered";
    order.deliveredAt = new Date();
    await order.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
