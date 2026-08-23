import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { isStripeConfigured } from "@/lib/stripe";
import {
  createEmbeddedSubscription,
  getOrCreateCustomerId,
  getOrCreatePriceId,
  ITEM_PACK_MONTHLY_CENTS,
  ITEMS_PER_PACK,
} from "@/lib/billing";
import { errorResponse } from "@/lib/api";

const bodySchema = z.object({ blocks: z.number().int().min(1).max(20) });

/**
 * Buy item-limit packs ($5/mo per +50 items) as a separate monthly subscription
 * (Stripe requires one billing interval per subscription, so this can't ride on
 * the annual membership). Quantity = number of +50 blocks. Returns a client secret
 * the browser confirms with the embedded Payment Element (no redirect).
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
    const priceId = await getOrCreatePriceId({
      lookupKey: "ms_item_pack_monthly",
      unitAmount: ITEM_PACK_MONTHLY_CENTS,
      interval: "month",
      productName: `MainStreet item pack (+${ITEMS_PER_PACK} items)`,
    });

    const { clientSecret } = await createEmbeddedSubscription({
      customer,
      priceId,
      quantity: parsed.data.blocks,
      metadata: { type: "item_pack", businessId },
    });

    return NextResponse.json({ clientSecret });
  } catch (err) {
    return errorResponse(err);
  }
}
