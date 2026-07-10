import { NextResponse } from "next/server";
import { getAdjacentTowns, logSearchExit } from "@/lib/search";

/**
 * Called when a search returns zero results. Logs the exit and returns the
 * ONLY external URL this platform ever surfaces — the Amazon affiliate
 * storefront — plus adjacent towns to keep discovery on-platform first.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 120);
  const townSlug = searchParams.get("town") ?? undefined;

  await logSearchExit({ query: q, townSlug, exitType: "bounced" });

  const nearbyTowns = townSlug ? await getAdjacentTowns(townSlug) : [];
  return NextResponse.json({
    nearbyTowns: nearbyTowns.map((t) => ({ name: t.name, state: t.state, slug: t.slug })),
    amazonStorefrontUrl: process.env.NEXT_PUBLIC_AMAZON_STOREFRONT_URL ?? null,
  });
}
