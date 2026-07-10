import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { Town } from "@/lib/models/Town";
import { User } from "@/lib/models/User";
import { createBusinessSchema } from "@/schemas/business";
import { uniqueSlug } from "@/lib/slug";
import { toBusinessDTO } from "@/lib/dto";
import { errorResponse } from "@/lib/api";

/** Create the current user's shop and promote them to `seller`. */
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

    await connectToDatabase();

    // One shop per owner in v1.
    const existing = await Business.findOne({ ownerId: user.id }).select("_id slug");
    if (existing) {
      return NextResponse.json(
        { error: "You already have a shop.", slug: existing.slug },
        { status: 409 },
      );
    }

    const town = await Town.findById(parsed.data.townId).select("_id");
    if (!town) throw new Error("NOT_FOUND");

    const slug = await uniqueSlug(
      parsed.data.name,
      async (s) => !!(await Business.exists({ slug: s })),
    );

    const biz = await Business.create({
      ownerId: user.id,
      townId: town._id,
      name: parsed.data.name,
      slug,
      category: parsed.data.category,
      description: parsed.data.description,
      membershipTier: "listed",
    });

    if (user.role === "consumer") {
      await User.updateOne({ _id: user.id }, { $set: { role: "seller", townId: town._id } });
    }

    return NextResponse.json({ business: toBusinessDTO(biz.toObject()) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
