import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { errorResponse } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Stripe Customer Portal — sellers manage/cancel subscriptions + payment methods. */
export async function POST() {
  try {
    const user = await requireRole(["seller", "admin"]);
    if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");
    await connectToDatabase();
    const dbUser = await User.findById(user.id).select("stripeCustomerId");
    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account yet." }, { status: 400 });
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${BASE}/seller/membership`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return errorResponse(err);
  }
}
