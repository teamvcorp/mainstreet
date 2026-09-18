import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { lookupProspects } from "@/lib/prospects/queries";

/**
 * Prospect lookup by city or ZIP. Admin only.
 *
 * The admin PAGE reads through lib/prospects/queries.ts directly (server component); this route
 * exists for the client island's post-ingest refresh and for scripted checks.
 *
 * NOTE: proxy.ts gates /admin/:path* but NOT /api/admin/*, so the requireRole call below is the
 * only thing standing between this data and the internet. Never remove it.
 */
export async function GET(request: Request) {
  try {
    const user = await requireRole(["admin"]);

    const rl = await rateLimit({
      key: "admin-prospect-lookup",
      limit: 60,
      windowSeconds: 60,
      identifier: user.id,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many lookups. Slow down." }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    // Clamp before the value reaches anything else, matching app/api/search/all/route.ts.
    const query = (searchParams.get("q") ?? "").slice(0, 120);
    const includeExcluded = searchParams.get("includeExcluded") === "true";
    const limit = Number.parseInt(searchParams.get("limit") ?? "", 10);

    const result = await lookupProspects({
      query,
      includeExcluded,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
