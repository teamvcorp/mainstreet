import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { countActiveProducts } from "@/lib/seller";
import { isPaidActivePlan } from "@/lib/membership";
import { isStripeConfigured } from "@/lib/stripe";
import { errorResponse } from "@/lib/api";

/** Current membership + item-limit status for the seller dashboard. */
export async function GET() {
  try {
    const user = await requireRole(["seller", "admin"]);
    const biz = await getMyBusiness(user.id);
    if (!biz) throw new Error("NOT_FOUND");
    const productCount = await countActiveProducts(biz._id.toString());
    return NextResponse.json({
      tier: biz.membershipTier,
      paidActive: isPaidActivePlan(biz),
      membershipExpiresAt: biz.membershipExpiresAt ?? null,
      itemLimit: biz.itemLimit,
      extraItemBlocks: biz.extraItemBlocks,
      productCount,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
