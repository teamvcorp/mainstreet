import { NextResponse } from "next/server";
import { ratesRequestSchema } from "@/schemas/checkout";
import { computeCartShipping } from "@/lib/shipping";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api";

/**
 * Per-business shipping options for the cart.
 *
 * Returns retail prices exactly as Storm Lake quotes them (no markup) and, notably,
 * NOT the underlying quoteIds — the browser has no use for them and we re-quote
 * authoritatively at order time. These figures are a DISPLAY quote; the amount the
 * buyer is actually charged comes from the server-side re-quote in lib/orders.
 */
export async function POST(request: Request) {
  try {
    const rl = await rateLimit({ key: "ship-rates", limit: 30, windowSeconds: 60, identifier: await getClientIp() });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many rate requests. Try again shortly." }, { status: 429 });
    }

    const parsed = ratesRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { toAddress, items } = parsed.data;

    // Rating needs only the destination: the partner API fixes the origin to Storm
    // Lake, and the recipient's name/street matter at /shipments, not at /rates.
    const shipping = await computeCartShipping(items, {
      city: toAddress.city,
      state: toAddress.state,
      zip: toAddress.zip,
    });

    return NextResponse.json({ shipping });
  } catch (err) {
    return errorResponse(err);
  }
}
