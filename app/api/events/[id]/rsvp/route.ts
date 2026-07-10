import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Event } from "@/lib/models/Event";
import { errorResponse } from "@/lib/api";

/** Toggle the current user's RSVP for an approved event. */
export async function POST(_request: Request, ctx: RouteContext<"/api/events/[id]/rsvp">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await connectToDatabase();

    const exists = await Event.exists({ _id: id, isApproved: true });
    if (!exists) throw new Error("NOT_FOUND");

    const has = await Event.exists({ _id: id, rsvps: user.id });
    await Event.updateOne(
      { _id: id },
      has ? { $pull: { rsvps: user.id } } : { $addToSet: { rsvps: user.id } },
    );
    const updated = await Event.findById(id).select("rsvps");
    const count = updated?.rsvps.length ?? 0;
    await Event.updateOne({ _id: id }, { $set: { rsvpCount: count } });

    return NextResponse.json({ rsvped: !has, rsvpCount: count });
  } catch (err) {
    return errorResponse(err);
  }
}
