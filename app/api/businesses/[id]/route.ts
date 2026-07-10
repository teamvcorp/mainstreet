import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { updateBusinessSchema } from "@/schemas/business";
import { geocodeAddress } from "@/lib/geocode";
import { toBusinessDTO } from "@/lib/dto";
import { errorResponse } from "@/lib/api";

/** Update a business. Owner-only (admins may edit any). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/businesses/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = updateBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const biz = await Business.findById(id);
    if (!biz) throw new Error("NOT_FOUND");
    if (biz.ownerId.toString() !== user.id && user.role !== "admin") {
      throw new Error("FORBIDDEN");
    }

    const data = parsed.data;

    // If a mailing address was provided, geocode to lat/lng for maps + shipping.
    if (data.address && (data.address.street || data.address.zip)) {
      const addr = [data.address.street, data.address.city, data.address.state, data.address.zip]
        .filter(Boolean)
        .join(", ");
      const geo = await geocodeAddress(addr).catch(() => null);
      if (geo) {
        biz.lat = geo.lat;
        biz.lng = geo.lng;
      }
    }

    Object.assign(biz, data);
    await biz.save();

    return NextResponse.json({ business: toBusinessDTO(biz.toObject()) });
  } catch (err) {
    return errorResponse(err);
  }
}
