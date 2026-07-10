import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Town } from "@/lib/models/Town";
import { Business } from "@/lib/models/Business";
import { errorResponse } from "@/lib/api";

const patchSchema = z.object({
  tagline: z.string().max(200).optional(),
  heroImageUrl: z.url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

/** Edit a town's hero/tagline/active flag. Admin only. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/towns/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    await connectToDatabase();
    const res = await Town.updateOne({ _id: id }, { $set: parsed.data });
    if (res.matchedCount === 0) throw new Error("NOT_FOUND");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Delete a town — blocked if it still has active businesses. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/towns/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    await connectToDatabase();
    const count = await Business.countDocuments({ townId: id, isActive: true });
    if (count > 0) {
      return NextResponse.json(
        { error: `This town has ${count} active business(es). Move or remove them first.` },
        { status: 409 },
      );
    }
    const res = await Town.deleteOne({ _id: id });
    if (res.deletedCount === 0) throw new Error("NOT_FOUND");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
