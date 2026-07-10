import { NextResponse } from "next/server";
import { z } from "zod";
import { getTowns } from "@/lib/towns";

// Coerce query strings → typed values. All fields optional.
const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(500).optional(), // miles
  q: z.string().trim().max(80).optional(),
  state: z.string().trim().length(2).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const { lat, lng, radius, q, state } = parsed.data;

  try {
    const towns = await getTowns({ lat, lng, radiusMiles: radius, q, state });
    return NextResponse.json({ towns });
  } catch (err) {
    console.error("GET /api/towns failed:", err);
    return NextResponse.json({ error: "Could not load towns" }, { status: 500 });
  }
}
