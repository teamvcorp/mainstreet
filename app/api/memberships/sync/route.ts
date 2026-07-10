import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { applySubscription } from "@/lib/billing";
import { errorResponse } from "@/lib/api";

/**
 * Reconcile the seller's plan from Stripe — a backstop for the webhook. Called
 * when the membership page loads so tier/expiry/item-limit are correct even if a
 * webhook was missed (e.g. localhost without `stripe listen`, or before the prod
 * endpoint is registered). Applies only active/trialing subs (upgrades);
 * downgrades still come from the webhook.
 */
export async function POST() {
  try {
    const user = await requireRole(["seller", "admin"]);
    if (!isStripeConfigured()) return NextResponse.json({ ok: false, reason: "not_configured" });

    await connectToDatabase();
    const dbUser = await User.findById(user.id).select("stripeCustomerId");
    if (!dbUser?.stripeCustomerId) return NextResponse.json({ ok: true, synced: 0 });

    const subs = await getStripe().subscriptions.list({
      customer: dbUser.stripeCustomerId,
      status: "all",
      limit: 20,
    });

    let synced = 0;
    for (const sub of subs.data) {
      if (sub.status === "active" || sub.status === "trialing") {
        await applySubscription(sub);
        synced += 1;
      }
    }
    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    return errorResponse(err);
  }
}
