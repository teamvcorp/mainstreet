import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { Event } from "@/lib/models/Event";
import { createEventSchema } from "@/schemas/event";
import { isPaidActivePlan } from "@/lib/membership";
import { moderateEventText } from "@/lib/ai/moderation";
import { getPublicEvents } from "@/lib/events";
import { toEventDTO } from "@/lib/dto";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Public feed (approved, upcoming). Used by the /events page poll + filters. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const events = await getPublicEvents({
      townSlug: searchParams.get("town") ?? undefined,
      category: searchParams.get("category") ?? undefined,
    });
    return NextResponse.json({ events });
  } catch (err) {
    console.error("GET /api/events failed:", err);
    return NextResponse.json({ error: "Could not load events." }, { status: 500 });
  }
}

/**
 * Create an event. Requirements enforced here:
 *  - only paid-plan ($150/yr) business owners may post
 *  - AI language check (reject inappropriate; flag borderline for review)
 *  - duplicate title (same shop) or same-time (same town ±2h) → admin approval
 *  - contact details come from the business record, not the form
 */
export async function POST(request: Request) {
  try {
    const user = await requireRole(["seller", "admin"]);
    const rl = await rateLimit({ key: "event-create", limit: 10, windowSeconds: 300, identifier: user.id });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const biz = await Business.findOne({ ownerId: user.id });
    if (!biz) throw new Error("NOT_FOUND");

    if (!isPaidActivePlan(biz) && user.role !== "admin") {
      return NextResponse.json(
        { error: "Posting events requires the $150 annual plan.", code: "PLAN_REQUIRED" },
        { status: 403 },
      );
    }

    // AI language screen.
    const mod = await moderateEventText({
      title: parsed.data.title,
      description: parsed.data.description,
    });
    if (!mod.allowed) {
      return NextResponse.json(
        { error: mod.reason ?? "This event can't be posted due to inappropriate content.", code: "REJECTED" },
        { status: 400 },
      );
    }

    const start = parsed.data.startAt;
    const windowMs = 2 * 60 * 60 * 1000; // ±2h counts as "same time"
    const [dup, sameTime] = await Promise.all([
      Event.findOne({
        businessId: biz._id,
        title: new RegExp(`^${escapeRegex(parsed.data.title)}$`, "i"),
      }).select("_id"),
      Event.findOne({
        townId: biz.townId,
        isApproved: true,
        startAt: { $gte: new Date(start.getTime() - windowMs), $lte: new Date(start.getTime() + windowMs) },
      }).select("_id"),
    ]);

    const needsApproval = mod.flagged || !!dup || !!sameTime;
    const reason = dup
      ? "A similar event already exists — sent for review."
      : sameTime
        ? "Another event is scheduled near this time — sent for review."
        : mod.flagged
          ? (mod.reason ?? "Flagged for review.")
          : undefined;

    const ev = await Event.create({
      townId: biz.townId,
      businessId: biz._id,
      postedBy: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      startAt: start,
      endAt: parsed.data.endAt,
      locationName: parsed.data.locationName,
      imageUrl: parsed.data.imageUrl || undefined,
      isFree: parsed.data.isFree,
      ticketUrl: parsed.data.ticketUrl || undefined,
      isApproved: !needsApproval,
    });

    return NextResponse.json(
      { event: toEventDTO(ev.toObject()), pending: needsApproval, reason },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
