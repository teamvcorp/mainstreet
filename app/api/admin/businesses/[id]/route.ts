import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { Product } from "@/lib/models/Product";
import { Event } from "@/lib/models/Event";
import { deleteTownIfEmpty } from "@/lib/towns";
import { errorResponse } from "@/lib/api";

const patchSchema = z.object({
  action: z.enum(["verify", "unverify", "suspend", "activate"]),
});

/** Verify / unverify / suspend / reactivate a business. Admin only. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/businesses/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const set =
      parsed.data.action === "verify"
        ? { verified: true }
        : parsed.data.action === "unverify"
          ? { verified: false }
          : parsed.data.action === "suspend"
            ? { isActive: false }
            : { isActive: true };

    await connectToDatabase();
    const res = await Business.updateOne({ _id: id }, { $set: set });
    if (res.matchedCount === 0) throw new Error("NOT_FOUND");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Hard-delete an unverified/spam business: removes its products and events too,
 * then prunes the town if it's now empty (keeps the directory clean).
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/businesses/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    await connectToDatabase();

    const biz = await Business.findById(id).select("townId");
    if (!biz) throw new Error("NOT_FOUND");
    const townId = biz.townId?.toString();

    await Promise.all([
      Product.deleteMany({ businessId: id }),
      Event.deleteMany({ businessId: id }),
      Business.deleteOne({ _id: id }),
    ]);

    if (townId) await deleteTownIfEmpty(townId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
