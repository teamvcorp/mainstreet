import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createIntentSchema } from "@/schemas/checkout";
import { createPendingOrdersForCheckout, discardPendingOrders } from "@/lib/orders";
import { getOrCreateCustomerId } from "@/lib/billing";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api";

/**
 * Create a PaymentIntent for the cart and return its client secret so the buyer
 * pays with the embedded Payment Element (on-site — no redirect).
 *
 * Multi-seller: charge the full total on the PLATFORM account (transfer_group,
 * no transfer_data); the webhook transfers each business's SUBTOTAL on
 * payment_intent.succeeded (shipping revenue stays on the platform). The card is
 * saved (setup_future_usage) for post-fulfillment shipping reconciliation.
 * Prices/shipping are recomputed server-side — the client can't set amounts.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const rl = await rateLimit({ key: "checkout", limit: 20, windowSeconds: 300, identifier: user.id });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }
    if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");

    const parsed = createIntentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout data" }, { status: 400 });
    }

    // Buyer changed shipping and re-entered payment — drop the prior pending orders.
    if (parsed.data.abandonOrderIds?.length) {
      await discardPendingOrders(user.id, parsed.data.abandonOrderIds);
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

    const customer = await getOrCreateCustomerId(user);
    const intent = await getStripe().paymentIntents.create({
      amount: prepared.grandTotalCents,
      currency: "usd",
      customer,
      setup_future_usage: "off_session", // retain card for shipping reconciliation
      automatic_payment_methods: { enabled: true }, // card + wallets + Link
      transfer_group: `grp_${prepared.orderIds[0]}`,
      metadata: { orderIds: prepared.orderIds.join(","), buyerId: user.id },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      orderIds: prepared.orderIds,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
