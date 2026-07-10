import { connectToDatabase } from "@/lib/db";
import { Town, type ITown } from "@/lib/models/Town";
import { Business, type IBusiness } from "@/lib/models/Business";
import { Event, type IEvent } from "@/lib/models/Event";
import { milesToMeters, metersToMiles } from "@/lib/geo";
import { toBusinessDTO, toEventDTO } from "@/lib/dto";
import { slugify } from "@/lib/utils";

export interface TownListItem {
  id: string;
  name: string;
  slug: string;
  state: string;
  county?: string;
  tagline?: string;
  heroImageUrl?: string;
  lat?: number;
  lng?: number;
  population?: number;
  distanceMiles?: number; // present only for "near me" queries
  businessCount: number;
  upcomingEventCount: number;
}

export interface GetTownsOpts {
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  q?: string;
  state?: string;
  limit?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMatch(opts: GetTownsOpts): Record<string, unknown> {
  const match: Record<string, unknown> = { isActive: true };
  if (opts.state) match.state = opts.state.toUpperCase();
  if (opts.q) match.name = { $regex: escapeRegex(opts.q), $options: "i" };
  return match;
}

/**
 * List active towns. When lat/lng are supplied, returns only towns within
 * `radiusMiles`, sorted nearest-first, each annotated with distanceMiles.
 * Every result is enriched with active-business and upcoming-event counts.
 */
export async function getTowns(opts: GetTownsOpts = {}): Promise<TownListItem[]> {
  await connectToDatabase();
  const limit = Math.min(opts.limit ?? 60, 200);

  interface RawTown {
    _id: unknown;
    name: string;
    slug: string;
    state: string;
    county?: string;
    tagline?: string;
    heroImageUrl?: string;
    lat?: number;
    lng?: number;
    population?: number;
    distanceMeters?: number;
  }

  let towns: RawTown[];
  if (typeof opts.lat === "number" && typeof opts.lng === "number") {
    const maxDistance = milesToMeters(opts.radiusMiles ?? 50);
    towns = await Town.aggregate<RawTown>([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [opts.lng, opts.lat] },
          distanceField: "distanceMeters",
          maxDistance,
          spherical: true,
          query: buildMatch(opts),
        },
      },
      { $limit: limit },
    ]);
  } else {
    towns = (await Town.find(buildMatch(opts)).sort({ name: 1 }).limit(limit).lean()) as unknown as RawTown[];
  }

  const ids = towns.map((t) => t._id);
  const [bizCounts, evCounts] = await Promise.all([
    Business.aggregate<{ _id: unknown; n: number }>([
      { $match: { townId: { $in: ids }, isActive: true } },
      { $group: { _id: "$townId", n: { $sum: 1 } } },
    ]),
    Event.aggregate<{ _id: unknown; n: number }>([
      { $match: { townId: { $in: ids }, startAt: { $gte: new Date() }, isApproved: true } },
      { $group: { _id: "$townId", n: { $sum: 1 } } },
    ]),
  ]);
  const bizMap = new Map(bizCounts.map((c) => [String(c._id), c.n]));
  const evMap = new Map(evCounts.map((c) => [String(c._id), c.n]));

  return towns.map((t) => ({
    id: String(t._id),
    name: t.name,
    slug: t.slug,
    state: t.state,
    county: t.county,
    tagline: t.tagline,
    heroImageUrl: t.heroImageUrl,
    lat: t.lat,
    lng: t.lng,
    population: t.population,
    distanceMiles:
      typeof t.distanceMeters === "number"
        ? Math.round(metersToMiles(t.distanceMeters) * 10) / 10
        : undefined,
    businessCount: bizMap.get(String(t._id)) ?? 0,
    upcomingEventCount: evMap.get(String(t._id)) ?? 0,
  }));
}

/**
 * Find or auto-create the town a business belongs to, derived from its address.
 * Towns are keyed by city+state (a logical grouping); each business's zip is
 * accumulated on the town for zipcode-grouping reports. Race-safe via the unique
 * slug index (a concurrent create just re-reads the winner).
 */
export async function findOrCreateTownForAddress(input: {
  city: string;
  state: string;
  zip?: string;
  lat?: number;
  lng?: number;
}): Promise<{ id: string; slug: string }> {
  await connectToDatabase();
  const city = input.city.trim();
  const state = input.state.trim().toUpperCase().slice(0, 2);
  const slug = slugify(`${city}-${state}`);

  const existing = await Town.findOne({ slug });
  if (existing) {
    // Backfill coords/zip if we learned them from this signup.
    let dirty = false;
    if (input.zip && !existing.zips.includes(input.zip)) {
      existing.zips.push(input.zip);
      dirty = true;
    }
    if (typeof existing.lat !== "number" && typeof input.lat === "number") {
      existing.lat = input.lat;
      existing.lng = input.lng;
      dirty = true;
    }
    if (dirty) await existing.save();
    return { id: existing._id.toString(), slug: existing.slug };
  }

  try {
    const created = await Town.create({
      name: city,
      state,
      slug,
      lat: input.lat,
      lng: input.lng,
      zips: input.zip ? [input.zip] : [],
      autoCreated: true,
      isActive: true,
    });
    return { id: created._id.toString(), slug: created.slug };
  } catch (err: unknown) {
    // Duplicate key from a concurrent create — re-read the winner.
    if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
      const t = await Town.findOne({ slug });
      if (t) return { id: t._id.toString(), slug: t.slug };
    }
    throw err;
  }
}

/** Delete a town if it has no active businesses and no events (tidy after prune). */
export async function deleteTownIfEmpty(townId: string): Promise<void> {
  await connectToDatabase();
  const [bizCount, evCount] = await Promise.all([
    Business.countDocuments({ townId, isActive: true }),
    Event.countDocuments({ townId }),
  ]);
  if (bizCount === 0 && evCount === 0) {
    await Town.deleteOne({ _id: townId, autoCreated: true });
  }
}

/** Full data for a single town's public page (/town/[slug]). Null if not found. */
export async function getTownPageData(slug: string) {
  await connectToDatabase();
  const town = await Town.findOne({ slug: slug.toLowerCase(), isActive: true }).lean<
    ITown & { _id: unknown }
  >();
  if (!town) return null;

  const [businesses, events] = await Promise.all([
    Business.find({ townId: town._id, isActive: true })
      .sort({ membershipTier: -1, name: 1 })
      .limit(60)
      .lean<(IBusiness & { _id: { toString(): string } })[]>(),
    Event.find({ townId: town._id, startAt: { $gte: new Date() }, isApproved: true })
      .sort({ startAt: 1 })
      .limit(12)
      .lean<(IEvent & { _id: { toString(): string } })[]>(),
  ]);

  return {
    town: {
      id: String(town._id),
      name: town.name,
      slug: town.slug,
      state: town.state,
      county: town.county,
      tagline: town.tagline,
      heroImageUrl: town.heroImageUrl,
      population: town.population,
      lat: town.lat,
      lng: town.lng,
    },
    businesses: businesses.map(toBusinessDTO),
    events: events.map(toEventDTO),
  };
}

/** Slugs of all active towns — for generateStaticParams on town pages. */
export async function getAllActiveTownSlugs(): Promise<string[]> {
  await connectToDatabase();
  const towns = await Town.find({ isActive: true }).select("slug").lean<{ slug: string }[]>();
  return towns.map((t) => t.slug);
}
