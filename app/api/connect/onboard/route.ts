import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { errorResponse } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Start (or resume) Stripe Connect Express onboarding. Creates the connected
 * account if needed, then redirects to Stripe's hosted onboarding flow. Stripe
 * collects bank + identity — we never see it.
 */
export async function GET() {
  try {
    const user = await requireRole(["seller", "admin"]);
    if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");

    await connectToDatabase();
    const biz = await Business.findOne({ ownerId: user.id });
    if (!biz) throw new Error("NOT_FOUND");

    const stripe = getStripe();
    if (!biz.stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? undefined,
        business_type: "individual",
        metadata: { businessId: biz._id.toString() },
      });
      biz.stripeAccountId = account.id;
      await biz.save();
    }

    const link = await stripe.accountLinks.create({
      account: biz.stripeAccountId,
      refresh_url: `${BASE}/api/connect/onboard`,
      return_url: `${BASE}/api/connect/callback`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(link.url);
  } catch (err) {
    return errorResponse(err);
  }
}
