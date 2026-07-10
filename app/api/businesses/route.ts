import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { User } from "@/lib/models/User";
import { createBusinessSchema } from "@/schemas/business";
import { uniqueSlug } from "@/lib/slug";
import { geocodeAddress } from "@/lib/geocode";
import { findOrCreateTownForAddress } from "@/lib/towns";
import { toBusinessDTO } from "@/lib/dto";
import { errorResponse } from "@/lib/api";

/**
 * Create the current user's shop. The town is derived from the address:
 * geocode → normalize city/state/zip → find-or-create the town → attach. The
 * user is promoted to `seller`.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const parsed = createBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const d = parsed.data;

    await connectToDatabase();

    // One shop per owner in v1.
    const existing = await Business.findOne({ ownerId: user.id }).select("_id slug");
    if (existing) {
      return NextResponse.json(
        { error: "You already have a shop.", slug: existing.slug },
        { status: 409 },
      );
    }

    // Geocode for map coords + normalized city/state/zip (best-effort).
    const addressLine = [d.street, d.city, d.state, d.zip].filter(Boolean).join(", ");
    const geo = await geocodeAddress(addressLine).catch(() => null);
    const city = geo?.city ?? d.city;
    const state = (geo?.state ?? d.state).toUpperCase().slice(0, 2);
    const zip = geo?.zip ?? d.zip;

    const town = await findOrCreateTownForAddress({
      city,
      state,
      zip,
      lat: geo?.lat,
      lng: geo?.lng,
    });

    const slug = await uniqueSlug(d.name, async (s) => !!(await Business.exists({ slug: s })));

    const biz = await Business.create({
      ownerId: user.id,
      townId: town.id,
      name: d.name,
      slug,
      category: d.category,
      description: d.description,
      address: { street: d.street, city, state, zip },
      lat: geo?.lat,
      lng: geo?.lng,
      membershipTier: "listed",
      verified: false,
    });

    if (user.role === "consumer") {
      await User.updateOne({ _id: user.id }, { $set: { role: "seller", townId: town.id } });
    }

    return NextResponse.json(
      { business: toBusinessDTO(biz.toObject()), townSlug: town.slug },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
