import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { isStripeConfigured } from "@/lib/stripe";
import {
  createEmbeddedSubscription,
  getOrCreateCustomerId,
  getOrCreatePriceId,
  MEMBERSHIP_ANNUAL_CENTS,
} from "@/lib/billing";
import { errorResponse } from "@/lib/api";

/**
 * Start the $150/yr seller membership as an embedded subscription. Returns a
 * client secret the browser confirms with the Payment Element (no redirect); the
 * subscription activates on payment via the webhook.
 */
export async function POST() {
  try {
    const user = await requireRole(["seller", "admin"]);
    if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");
    const biz = await getMyBusiness(user.id);
    if (!biz) throw new Error("NOT_FOUND");

    const businessId = biz._id.toString();
    const customer = await getOrCreateCustomerId(user);
    const priceId = await getOrCreatePriceId({
      lookupKey: "ms_seller_membership_annual",
      unitAmount: MEMBERSHIP_ANNUAL_CENTS,
      interval: "year",
      productName: "MainStreet Seller Membership (annual)",
    });

    const { clientSecret } = await createEmbeddedSubscription({
      customer,
      priceId,
      metadata: { type: "membership", businessId },
    });

    return NextResponse.json({ clientSecret });
  } catch (err) {
    return errorResponse(err);
  }
}
