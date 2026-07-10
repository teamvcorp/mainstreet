import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Business } from "@/lib/models/Business";
import { Membership } from "@/lib/models/Membership";

export const BASE_ITEM_LIMIT = 10;
export const ITEMS_PER_PACK = 50;
export const MEMBERSHIP_ANNUAL_CENTS = 15000; // $150/yr
export const ITEM_PACK_MONTHLY_CENTS = 500; // $5/mo per +50 items

export function itemLimitForBlocks(blocks: number): number {
  return BASE_ITEM_LIMIT + ITEMS_PER_PACK * Math.max(0, blocks);
}

/** Reuse (or lazily create) the Stripe Customer for a user. */
export async function getOrCreateCustomerId(user: {
  id: string;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  await connectToDatabase();
  const dbUser = await User.findById(user.id).select("stripeCustomerId email name");
  if (dbUser?.stripeCustomerId) return dbUser.stripeCustomerId;
  const customer = await getStripe().customers.create({
    email: user.email ?? dbUser?.email ?? undefined,
    name: dbUser?.name ?? undefined,
    metadata: { userId: user.id },
  });
  await User.updateOne({ _id: user.id }, { $set: { stripeCustomerId: customer.id } });
  return customer.id;
}

/**
 * Apply a subscription's current state to the business. Called from the webhook
 * for checkout.session.completed (subscription), customer.subscription.updated,
 * and .deleted — idempotent, driven entirely by the subscription's metadata +
 * status so it converges no matter which event arrives.
 */
export async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const businessId = sub.metadata?.businessId;
  const type = sub.metadata?.type;
  if (!businessId || !type) return;

  await connectToDatabase();
  const active = sub.status === "active" || sub.status === "trialing";
  // current_period_end lives on the subscription (or its first item in newer APIs).
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end;
  const expiresAt = periodEnd ? new Date(periodEnd * 1000) : undefined;

  if (type === "membership") {
    await Business.updateOne(
      { _id: businessId },
      { $set: active ? { membershipTier: "seller", membershipExpiresAt: expiresAt } : { membershipTier: "listed" } },
    );
    await Membership.updateOne(
      { stripeSubscriptionId: sub.id },
      {
        $set: {
          businessId,
          tier: "seller",
          priceCents: MEMBERSHIP_ANNUAL_CENTS,
          expiresAt,
          isActive: active,
        },
        $setOnInsert: { startedAt: new Date() },
      },
      { upsert: true },
    );
  } else if (type === "item_pack") {
    const blocks = active ? (sub.items?.data?.[0]?.quantity ?? 0) : 0;
    await Business.updateOne(
      { _id: businessId },
      { $set: { extraItemBlocks: blocks, itemLimit: itemLimitForBlocks(blocks) } },
    );
  }
}
