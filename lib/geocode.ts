import type { LatLng } from "@/lib/geo";

/**
 * Server-side geocoding via Google Maps Geocoding API (GOOGLE_MAPS_API_KEY).
 * The spec explicitly allows Google geocoding for location resolution — this is
 * NOT platform search (which stays internal-only). Returns null when the key is
 * absent so the app degrades gracefully in dev (users can still "share location").
 */
export interface GeocodeResult extends LatLng {
  city?: string;
  state?: string;
  zip?: string;
  formatted?: string;
}

function pickComponent(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  type: string,
  useShort = false,
): string | undefined {
  const c = components.find((x) => x.types.includes(type));
  return c ? (useShort ? c.short_name : c.long_name) : undefined;
}

async function callGoogle(params: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}&key=${key}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return null;

  const r = data.results[0];
  const loc = r.geometry?.location;
  if (!loc) return null;
  const comps = r.address_components ?? [];
  return {
    lat: loc.lat,
    lng: loc.lng,
    city:
      pickComponent(comps, "locality") ??
      pickComponent(comps, "postal_town") ??
      pickComponent(comps, "administrative_area_level_2"),
    state: pickComponent(comps, "administrative_area_level_1", true),
    zip: pickComponent(comps, "postal_code"),
    formatted: r.formatted_address,
  };
}

/** Resolve a US ZIP code to a coordinate. Returns null if not found / no key. */
export function geocodeZip(zip: string): Promise<GeocodeResult | null> {
  return callGoogle(`components=postal_code:${encodeURIComponent(zip)}|country:US`);
}

/** Resolve a free-form address (used in seller onboarding, Phase 2). */
export function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  return callGoogle(`address=${encodeURIComponent(address)}`);
}
