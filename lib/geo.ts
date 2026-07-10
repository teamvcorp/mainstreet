export const MILE_IN_METERS = 1609.344;
export const milesToMeters = (mi: number) => mi * MILE_IN_METERS;
export const metersToMiles = (m: number) => m / MILE_IN_METERS;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in miles between two coordinates (Haversine). */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613; // Earth radius in miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
