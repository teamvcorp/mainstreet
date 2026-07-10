import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Event } from "@/lib/models/Event";
import { errorResponse } from "@/lib/api";
import { z } from "zod";

const bodySchema = z.object({ action: z.enum(["approve", "reject"]) });

/** Approve (publish) or reject (delete) a pending event. Admin only. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/events/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await connectToDatabase();
    if (parsed.data.action === "approve") {
      const res = await Event.updateOne({ _id: id }, { $set: { isApproved: true } });
      if (res.matchedCount === 0) throw new Error("NOT_FOUND");
    } else {
      const res = await Event.deleteOne({ _id: id });
      if (res.deletedCount === 0) throw new Error("NOT_FOUND");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
