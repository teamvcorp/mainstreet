import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { errorResponse } from "@/lib/api";

/** Current Stripe Connect status for the seller's shop. */
export async function GET() {
  try {
    const user = await requireRole(["seller", "admin"]);
    await connectToDatabase();
    const biz = await Business.findOne({ ownerId: user.id }).select(
      "stripeAccountId stripeAccountActive",
    );

    let detailsSubmitted = false;
    let chargesEnabled = false;
    let payoutsEnabled = false;

    if (biz?.stripeAccountId && isStripeConfigured()) {
      const acct = await getStripe().accounts.retrieve(biz.stripeAccountId);
      detailsSubmitted = !!acct.details_submitted;
      chargesEnabled = !!acct.charges_enabled;
      payoutsEnabled = !!acct.payouts_enabled;
    }

    return NextResponse.json({
      connected: !!biz?.stripeAccountId,
      active: biz?.stripeAccountActive ?? false,
      detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
      configured: isStripeConfigured(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
