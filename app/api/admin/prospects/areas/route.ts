import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { ProspectArea, type IProspectArea } from "@/lib/models/ProspectArea";
import { parseAreaQuery } from "@/lib/prospects/normalize";
import { requestAreaSchema } from "@/schemas/prospects";

const HOME_STATE = (process.env.PROSPECTS_DEFAULT_STATE ?? "IA").toUpperCase();

/** List every requested area and its coverage state. Admin only. */
export async function GET() {
  try {
    const user = await requireRole(["admin"]);
    await connectToDatabase();
    const areas = await ProspectArea.find()
      .sort({ lastRequestedAt: -1 })
      .limit(300)
      .lean<IProspectArea[]>();

    return NextResponse.json({
      areas: areas.map((a) => ({
        id: a._id.toString(),
        key: a.key,
        kind: a.kind,
        label: a.label,
        state: a.state,
        status: a.status,
        aliases: a.aliases ?? [],
        prospectCount: a.prospectCount ?? 0,
        scannedCount: a.scannedCount ?? 0,
        requestCount: a.requestCount ?? 0,
        coveredAt: a.coveredAt ? new Date(a.coveredAt).toISOString() : undefined,
        lastRequestedAt: new Date(a.lastRequestedAt).toISOString(),
        error: a.error,
      })),
      requestedBy: user.id,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Queue a city or ZIP for the next ingest pass.
 *
 * Idempotent: the unique index on `key` means a double-clicked button bumps `requestCount`
 * rather than creating a second ledger row. Re-requesting an already-covered area sends it back
 * to `queued` so the next pass refreshes it.
 */
export async function POST(request: Request) {
  try {
    const user = await requireRole(["admin"]);

    const rl = await rateLimit({
      key: "admin-prospect-area",
      limit: 30,
      windowSeconds: 60,
      identifier: user.id,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
    }

    const parsed = requestAreaSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const area = parseAreaQuery(parsed.data.query, HOME_STATE);
    if (!area) {
      return NextResponse.json(
        { error: "Enter a city (e.g. Storm Lake) or a 5-digit ZIP code." },
        { status: 400 },
      );
    }
    // v1 source is Iowa-only; anything else would silently return nothing.
    if (area.state !== HOME_STATE) throw new Error("AREA_UNSUPPORTED");

    await connectToDatabase();
    const now = new Date();
    const res = await ProspectArea.findOneAndUpdate(
      { key: area.key },
      {
        $set: {
          kind: area.kind,
          label: area.label,
          city: area.city,
          state: area.state,
          zip5: area.zip5,
          lastRequestedAt: now,
          // An already-covered area goes back in the queue so the next pass refreshes it.
          status: "requested",
        },
        $setOnInsert: { requestedBy: user.id, aliases: [] },
        $inc: { requestCount: 1 },
      },
      { upsert: true, new: true },
    );

    return NextResponse.json(
      { ok: true, id: res._id.toString(), key: area.key, label: area.label, status: res.status },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
