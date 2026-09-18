import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { backfillShipmentTracking } from "@/lib/fulfillment";

/**
 * Backfill tracking numbers for `pickup_pack` orders.
 *
 * That mode returns no tracking when the shipment is created (Storm Lake packs and
 * ships it later) and the Partner API exposes no webhook, so polling our own
 * shipment history is the only way to learn the number. Rows are matched on
 * `orderRef` and advance the order `processing -> shipped`.
 *
 * Auth mirrors the weekly digest: Vercel Cron sends `Authorization: Bearer
 * <CRON_SECRET>`; admins may also trigger it by hand.
 */
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const isCron = !!secret && auth === `Bearer ${secret}`;

  let isAdmin = false;
  if (!isCron) {
    const user = await getSessionUser().catch(() => null);
    isAdmin = user?.role === "admin";
  }
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await backfillShipmentTracking();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("shipment-tracking backfill failed:", err);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
