import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { errorResponse } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Return URL from Stripe onboarding — refresh the account's readiness flags. */
export async function GET() {
  try {
    const user = await requireRole(["seller", "admin"]);
    await connectToDatabase();
    const biz = await Business.findOne({ ownerId: user.id });

    if (biz?.stripeAccountId && isStripeConfigured()) {
      const account = await getStripe().accounts.retrieve(biz.stripeAccountId);
      biz.stripeAccountActive = !!(account.charges_enabled && account.details_submitted);
      await biz.save();
    }

    return NextResponse.redirect(`${BASE}/seller/connect?done=1`);
  } catch (err) {
    return errorResponse(err);
  }
}
