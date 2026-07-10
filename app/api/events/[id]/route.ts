import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { Event } from "@/lib/models/Event";
import { updateEventSchema } from "@/schemas/event";
import { moderateEventText } from "@/lib/ai/moderation";
import { toEventDTO } from "@/lib/dto";
import { errorResponse } from "@/lib/api";

/**
 * Edit an event. Per product rules, ONLY the name (title) and details
 * (description) are editable — date/time/location/contact are fixed. Edited text
 * is re-screened; if flagged it re-enters the approval queue.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  try {
    const user = await requireRole(["seller", "admin"]);
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const ev = await Event.findById(id);
    if (!ev) throw new Error("NOT_FOUND");

    const biz = await Business.findById(ev.businessId).select("ownerId");
    if (!biz) throw new Error("NOT_FOUND");
    if (biz.ownerId.toString() !== user.id && user.role !== "admin") throw new Error("FORBIDDEN");

    const nextTitle = parsed.data.title ?? ev.title;
    const nextDescription = parsed.data.description ?? ev.description;
    const mod = await moderateEventText({ title: nextTitle, description: nextDescription });
    if (!mod.allowed) {
      return NextResponse.json(
        { error: mod.reason ?? "Inappropriate content." },
        { status: 400 },
      );
    }

    if (parsed.data.title !== undefined) ev.title = parsed.data.title;
    if (parsed.data.description !== undefined) ev.description = parsed.data.description;
    if (mod.flagged && user.role !== "admin") ev.isApproved = false; // re-queue

    await ev.save();
    return NextResponse.json({ event: toEventDTO(ev.toObject()), pending: !ev.isApproved });
  } catch (err) {
    return errorResponse(err);
  }
}
