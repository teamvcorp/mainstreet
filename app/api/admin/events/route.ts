import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Event } from "@/lib/models/Event";
import "@/lib/models/Business";
import "@/lib/models/Town";
import { errorResponse } from "@/lib/api";

/** Events awaiting admin approval (duplicates, same-time, or AI-flagged). */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectToDatabase();
    const pending = await Event.find({ isApproved: false })
      .sort({ createdAt: -1 })
      .populate("businessId", "name slug")
      .populate("townId", "name state slug")
      .lean();

    const events = pending.map((e) => {
      const biz = e.businessId as unknown as { name?: string; slug?: string } | null;
      const town = e.townId as unknown as { name?: string; state?: string } | null;
      return {
        id: String(e._id),
        title: e.title,
        description: e.description,
        category: e.category,
        startAt: e.startAt ? new Date(e.startAt).toISOString() : undefined,
        locationName: e.locationName,
        business: biz ? { name: biz.name, slug: biz.slug } : null,
        town: town ? { name: town.name, state: town.state } : null,
      };
    });
    return NextResponse.json({ events });
  } catch (err) {
    return errorResponse(err);
  }
}
