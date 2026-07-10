import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Town } from "@/lib/models/Town";
import { uniqueSlug } from "@/lib/slug";
import { geocodeAddress } from "@/lib/geocode";
import { errorResponse } from "@/lib/api";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  state: z.string().length(2).transform((s) => s.toUpperCase()),
  tagline: z.string().max(200).optional(),
  heroImageUrl: z.url().optional().or(z.literal("")),
});

/** Manually create a town (admins). Auto-towns from onboarding are the norm. */
export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const d = parsed.data;
    await connectToDatabase();
    const slug = await uniqueSlug(`${d.name}-${d.state}`, async (s) => !!(await Town.exists({ slug: s })));
    const geo = await geocodeAddress(`${d.name}, ${d.state}`).catch(() => null);
    const town = await Town.create({
      name: d.name,
      state: d.state,
      slug,
      tagline: d.tagline,
      heroImageUrl: d.heroImageUrl || undefined,
      lat: geo?.lat,
      lng: geo?.lng,
      isActive: true,
      autoCreated: false,
    });
    return NextResponse.json({ ok: true, id: town._id.toString(), slug }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
