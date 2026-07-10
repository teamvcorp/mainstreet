import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { BusinessSuggestion } from "@/lib/models/BusinessSuggestion";
import { errorResponse } from "@/lib/api";

const bodySchema = z.object({ status: z.enum(["pending", "contacted", "joined", "declined"]) });

/** Update a business suggestion's outreach status. Admin only. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/suggestions/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    await connectToDatabase();
    const res = await BusinessSuggestion.updateOne({ _id: id }, { $set: { status: parsed.data.status } });
    if (res.matchedCount === 0) throw new Error("NOT_FOUND");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
