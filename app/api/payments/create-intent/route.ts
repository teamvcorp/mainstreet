import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createIntentSchema } from "@/schemas/checkout";
import { createPendingOrdersForCheckout } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Create a hosted Stripe Checkout Session for the cart.
 *
 * Multi-seller model: we charge the full total on the PLATFORM account (no
 * transfer_data), tagged with a transfer_group. The webhook then creates a
 * Transfer of each business's SUBTOTAL to that seller's connected account
 * (shipping revenue stays with the platform). Prices/shipping are recomputed
 * server-side in createPendingOrdersForCheckout — the client can't set amounts.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const rl = await rateLimit({ key: "checkout", limit: 15, windowSeconds: 300, identifier: user.id });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }
    if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");

    const parsed = createIntentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout data" }, { status: 400 });
    }

    const prepared = await createPendingOrdersForCheckout({
      buyerId: user.id,
      items: parsed.data.items,
      toAddress: parsed.data.toAddress,
      selections: parsed.data.selections,
    });

    if (prepared.grandTotalCents <= 0) {
      return NextResponse.json({ error: "Cart total is zero." }, { status: 400 });
    }

    const transferGroup = `grp_${prepared.orderIds[0]}`;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: prepared.lineItems.map((li) => ({
        quantity: li.quantity,
        price_data: {
          currency: "usd",
          unit_amount: li.amountCents,
          product_data: { name: li.name },
        },
      })),
      customer_email: user.email ?? undefined,
      payment_intent_data: {
        transfer_group: transferGroup,
        metadata: { orderIds: prepared.orderIds.join(","), buyerId: user.id },
      },
      metadata: { orderIds: prepared.orderIds.join(","), buyerId: user.id },
      success_url: `${BASE}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/cart`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return errorResponse(err);
  }
}
