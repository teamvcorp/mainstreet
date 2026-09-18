import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { ProspectArea } from "@/lib/models/ProspectArea";
import { Prospect } from "@/lib/models/Prospect";
import { areaActionSchema } from "@/schemas/prospects";

/**
 * Keyed by ObjectId rather than the area key, matching /api/admin/towns/[id] — and because an
 * area key contains a colon ("city:storm-lake-ia"), which is awkward in a path segment.
 */

/** Re-queue an area so the next pass refreshes it. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/prospects/areas/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    const parsed = areaActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    await connectToDatabase();
    const area = await ProspectArea.findById(id);
    if (!area) throw new Error("NOT_FOUND");
    // A pass currently scanning for this area would race with the status change.
    if (area.status === "running") throw new Error("INGEST_RUNNING");

    area.status = "requested";
    area.lastRequestedAt = new Date();
    area.error = undefined;
    await area.save();

    return NextResponse.json({ ok: true, status: area.status });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Stop tracking an area.
 *
 * The prospects it pulled are deliberately KEPT: they may already carry an admin-typed email,
 * notes, an opt-out, or campaign history, none of which we can recover. Removing the ledger row
 * only stops future refreshes.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/prospects/areas/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    await connectToDatabase();

    const area = await ProspectArea.findById(id);
    if (!area) throw new Error("NOT_FOUND");
    if (area.status === "running") throw new Error("INGEST_RUNNING");

    const filter = area.kind === "city"
      ? { cityKey: area.key.slice("city:".length) }
      : { zip5: area.zip5 };
    const kept = await Prospect.countDocuments(filter);

    await ProspectArea.deleteOne({ _id: area._id });
    return NextResponse.json({ ok: true, keptProspects: kept });
  } catch (err) {
    return errorResponse(err);
  }
}
