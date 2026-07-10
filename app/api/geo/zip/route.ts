import { NextResponse } from "next/server";
import { geocodeZip } from "@/lib/geocode";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = (searchParams.get("zip") ?? "").trim();

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Enter a valid 5-digit ZIP code." }, { status: 400 });
  }

  // Light throttle to protect our geocoding quota.
  const rl = await rateLimit({ key: "geo-zip", limit: 30, windowSeconds: 60, identifier: await getClientIp() });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many lookups. Try again shortly." }, { status: 429 });
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return NextResponse.json(
      { error: "ZIP lookup isn't configured yet. Use “Share my location” instead." },
      { status: 501 },
    );
  }

  const result = await geocodeZip(zip);
  if (!result) {
    return NextResponse.json({ error: "We couldn't find that ZIP code." }, { status: 404 });
  }

  return NextResponse.json({
    lat: result.lat,
    lng: result.lng,
    city: result.city,
    state: result.state,
  });
}
