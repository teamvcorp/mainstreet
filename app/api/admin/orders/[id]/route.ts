import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import "@/lib/models/Business";
import "@/lib/models/User";
import { fulfillOrderSchema } from "@/schemas/fulfillment";
import { sendEmail } from "@/lib/email";
import { shippedEmail } from "@/lib/order-emails";
import { errorResponse } from "@/lib/api";

/**
 * Fulfillment update (admin / SL Pack & Ship). "ship" attaches tracking + label
 * and notifies the buyer; "deliver"/"processing" advance status.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/orders/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    const parsed = fulfillOrderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const d = parsed.data;

    await connectToDatabase();
    const order = await Order.findById(id)
      .populate("businessId", "name")
      .populate("buyerId", "email");
    if (!order) throw new Error("NOT_FOUND");

    if (d.action === "ship") {
      if (!d.trackingNumber) {
        return NextResponse.json({ error: "A tracking number is required to mark shipped." }, { status: 400 });
      }
      order.status = "shipped";
      order.shippedAt = new Date();
      order.trackingNumber = d.trackingNumber;
      if (d.carrier) order.carrier = d.carrier;
      if (d.service) order.service = d.service;
      if (d.labelUrl) order.labelUrl = d.labelUrl;
      await order.save();

      const buyer = order.buyerId as unknown as { email?: string } | null;
      const biz = order.businessId as unknown as { name?: string } | null;
      if (buyer?.email) {
        await sendEmail({
          to: buyer.email,
          ...shippedEmail({
            orderId: id,
            businessName: biz?.name ?? "the shop",
            carrier: order.carrier,
            service: order.service,
            trackingNumber: order.trackingNumber,
          }),
        });
      }
    } else if (d.action === "deliver") {
      order.status = "delivered";
      order.deliveredAt = new Date();
      await order.save();
    } else {
      order.status = "processing";
      await order.save();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
