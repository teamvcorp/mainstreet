import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { reconcileShipping } from "@/lib/reconcile";
import { sendEmail } from "@/lib/email";
import { shippingDueEmail } from "@/lib/order-emails";
import { errorResponse } from "@/lib/api";

const bodySchema = z.object({
  // final buyer shipping total, in cents
  finalShippingCents: z.number().int().min(0).max(1_000_000),
});

/**
 * Admin reconciles final shipping vs the estimate charged at checkout.
 * Charges/refunds the difference; on off-session failure, emails the buyer a
 * secure pay link. Admin only. (Shipping revenue stays on the platform.)
 */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/orders/[id]/shipping">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid final shipping amount." }, { status: 400 });
    }

    const result = await reconcileShipping(id, parsed.data.finalShippingCents);

    if (result.status === "buyer_action") {
      // Off-session charge failed → email the buyer the pay link.
      if (result.buyerEmail) {
        await sendEmail({
          to: result.buyerEmail,
          ...shippingDueEmail({ orderId: result.orderId, amountCents: result.delta, payUrl: result.url }),
        });
      }
      return NextResponse.json({
        status: "buyer_action",
        delta: result.delta,
        emailed: !!result.buyerEmail,
      });
    }

    return NextResponse.json({ status: result.status, delta: result.delta });
  } catch (err) {
    return errorResponse(err);
  }
}
