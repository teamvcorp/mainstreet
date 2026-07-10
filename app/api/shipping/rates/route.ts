import { NextResponse } from "next/server";
import { ratesRequestSchema } from "@/schemas/checkout";
import { computeCartShipping } from "@/lib/shipping";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api";

/**
 * Per-business shipping options for the cart. Returns ONLY consumer prices
 * (already marked up) — carrier cost never leaves lib/shipping.
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

    const shipping = await computeCartShipping(items, {
      name: toAddress.name,
      street1: toAddress.street,
      city: toAddress.city,
      state: toAddress.state,
      zip: toAddress.zip,
    });

    return NextResponse.json({ shipping });
  } catch (err) {
    return errorResponse(err);
  }
}
