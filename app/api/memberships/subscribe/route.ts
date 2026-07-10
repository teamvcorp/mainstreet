import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getOrCreateCustomerId, MEMBERSHIP_ANNUAL_CENTS } from "@/lib/billing";
import { errorResponse } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Start the $150/yr seller membership via a Stripe subscription Checkout. */
export async function POST() {
  try {
    const user = await requireRole(["seller", "admin"]);
    if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");
    const biz = await getMyBusiness(user.id);
    if (!biz) throw new Error("NOT_FOUND");

    const businessId = biz._id.toString();
    const customer = await getOrCreateCustomerId(user);

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: MEMBERSHIP_ANNUAL_CENTS,
            recurring: { interval: "year" },
            product_data: { name: "MainStreet Seller Membership (annual)" },
          },
        },
      ],
      metadata: { type: "membership", businessId },
      subscription_data: { metadata: { type: "membership", businessId } },
      success_url: `${BASE}/seller/membership?done=1`,
      cancel_url: `${BASE}/seller/membership`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return errorResponse(err);
  }
}
