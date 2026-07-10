import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getOrCreateCustomerId, ITEM_PACK_MONTHLY_CENTS, ITEMS_PER_PACK } from "@/lib/billing";
import { errorResponse } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const bodySchema = z.object({ blocks: z.number().int().min(1).max(20) });

/**
 * Buy item-limit packs ($5/mo per +50 items) as a separate monthly subscription
 * (Stripe requires one billing interval per subscription, so this can't ride on
 * the annual membership). Quantity = number of +50 blocks.
 */
export async function POST(request: Request) {
  try {
    const user = await requireRole(["seller", "admin"]);
    if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose 1–20 packs" }, { status: 400 });

    const biz = await getMyBusiness(user.id);
    if (!biz) throw new Error("NOT_FOUND");
    const businessId = biz._id.toString();
    const customer = await getOrCreateCustomerId(user);

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [
        {
          quantity: parsed.data.blocks,
          price_data: {
            currency: "usd",
            unit_amount: ITEM_PACK_MONTHLY_CENTS,
            recurring: { interval: "month" },
            product_data: { name: `MainStreet item pack (+${ITEMS_PER_PACK} items)` },
          },
        },
      ],
      metadata: { type: "item_pack", businessId },
      subscription_data: { metadata: { type: "item_pack", businessId } },
      success_url: `${BASE}/seller/membership?items=1`,
      cancel_url: `${BASE}/seller/membership`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return errorResponse(err);
  }
}
