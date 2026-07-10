import { connectToDatabase } from "@/lib/db";
import { Business, type IBusiness } from "@/lib/models/Business";
import { Product, type IProduct } from "@/lib/models/Product";
import { Event } from "@/lib/models/Event";
import { Town } from "@/lib/models/Town";
import { SearchExit, type ExitType } from "@/lib/models/SearchExit";
import { getTowns, type TownListItem } from "@/lib/towns";

/**
 * PLATFORM-ONLY SEARCH. Every function here queries ONLY our own MongoDB
 * collections — never the internet, never a third-party API. This is the hard
 * rule from the spec. (Atlas Search `$search` can be layered on in production
 * for typo-tolerance/relevance without changing callers — see docs/atlas-search.md.)
 */

function rx(q: string): RegExp {
  return new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

type Lean<T> = T & { _id: { toString(): string } };

export interface BusinessHit {
  id: string;
  slug: string;
  name: string;
  category?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  town?: { name: string; state: string; slug: string };
}

export interface ProductHit {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  images: string[];
  storeSlug: string;
  storeName: string;
  category?: string;
}

export interface SearchFilters {
  townSlug?: string;
  state?: string;
  category?: string;
  minPrice?: number; // cents
  maxPrice?: number; // cents
  limit?: number;
}

async function townIdsForState(state: string): Promise<unknown[]> {
  const towns = await Town.find({ state: state.toUpperCase() }).select("_id").lean<{ _id: unknown }[]>();
  return towns.map((t) => t._id);
}

export async function searchBusinesses(q: string, filters: SearchFilters = {}): Promise<BusinessHit[]> {
  await connectToDatabase();
  const limit = Math.min(filters.limit ?? 24, 60);
  const filter: Record<string, unknown> = { isActive: true };

  if (q) filter.$or = [{ name: rx(q) }, { description: rx(q) }, { category: rx(q) }, { story: rx(q) }];
  if (filters.category) filter.category = rx(filters.category);

  if (filters.townSlug) {
    const t = await Town.findOne({ slug: filters.townSlug.toLowerCase() }).select("_id");
    if (!t) return [];
    filter.townId = t._id;
  } else if (filters.state) {
    filter.townId = { $in: await townIdsForState(filters.state) };
  }

  const items = await Business.find(filter)
    .sort({ membershipTier: -1, name: 1 })
    .limit(limit)
    .populate("townId", "name state slug")
    .lean<(Lean<IBusiness> & { townId?: { name: string; state: string; slug: string } })[]>();

  return items.map((b) => ({
    id: b._id.toString(),
    slug: b.slug,
    name: b.name,
    category: b.category,
    description: b.description,
    logoUrl: b.logoUrl,
    bannerUrl: b.bannerUrl,
    town: b.townId ? { name: b.townId.name, state: b.townId.state, slug: b.townId.slug } : undefined,
  }));
}

export async function searchProducts(q: string, filters: SearchFilters = {}): Promise<ProductHit[]> {
  await connectToDatabase();
  const limit = Math.min(filters.limit ?? 24, 60);
  const filter: Record<string, unknown> = { isActive: true };

  if (q) filter.$or = [{ name: rx(q) }, { description: rx(q) }, { category: rx(q) }, { tags: rx(q) }];
  if (filters.category) filter.category = rx(filters.category);
  if (typeof filters.minPrice === "number" || typeof filters.maxPrice === "number") {
    const price: Record<string, number> = {};
    if (typeof filters.minPrice === "number") price.$gte = filters.minPrice;
    if (typeof filters.maxPrice === "number") price.$lte = filters.maxPrice;
    filter.priceCents = price;
  }

  const items = await Product.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("businessId", "slug name isActive")
    .lean<(Lean<IProduct> & { businessId?: { slug: string; name: string; isActive: boolean } })[]>();

  return items
    .filter((p) => p.businessId?.isActive)
    .map((p) => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      priceCents: p.priceCents,
      images: p.images ?? [],
      storeSlug: p.businessId!.slug,
      storeName: p.businessId!.name,
      category: p.category,
    }));
}

export interface EventHit {
  id: string;
  title: string;
  startAt?: string;
  category: string;
  town?: { name: string; state: string; slug: string };
}

export async function searchEvents(q: string, filters: SearchFilters = {}): Promise<EventHit[]> {
  await connectToDatabase();
  const limit = Math.min(filters.limit ?? 24, 60);
  const filter: Record<string, unknown> = { isApproved: true, startAt: { $gte: new Date() } };
  if (q) filter.$or = [{ title: rx(q) }, { description: rx(q) }];
  if (filters.category) filter.category = filters.category;
  if (filters.townSlug) {
    const t = await Town.findOne({ slug: filters.townSlug.toLowerCase() }).select("_id");
    if (!t) return [];
    filter.townId = t._id;
  }

  const items = await Event.find(filter)
    .sort({ startAt: 1 })
    .limit(limit)
    .populate("townId", "name state slug")
    .lean<{ _id: { toString(): string }; title: string; startAt?: Date; category: string; townId?: { name: string; state: string; slug: string } }[]>();

  return items.map((e) => ({
    id: e._id.toString(),
    title: e.title,
    startAt: e.startAt ? new Date(e.startAt).toISOString() : undefined,
    category: e.category,
    town: e.townId ? { name: e.townId.name, state: e.townId.state, slug: e.townId.slug } : undefined,
  }));
}

export async function searchAll(q: string, filters: SearchFilters = {}) {
  const [businesses, products, events] = await Promise.all([
    searchBusinesses(q, { ...filters, limit: 12 }),
    searchProducts(q, { ...filters, limit: 12 }),
    searchEvents(q, { ...filters, limit: 12 }),
  ]);
  return { businesses, products, events };
}

/** Towns near the searched town (for the "adjacent towns" empty-state layer). */
export async function getAdjacentTowns(townSlug: string, limit = 3): Promise<TownListItem[]> {
  await connectToDatabase();
  const town = await Town.findOne({ slug: townSlug.toLowerCase() }).select("lat lng").lean<{
    lat?: number;
    lng?: number;
  }>();
  if (!town?.lat || !town?.lng) return [];
  const near = await getTowns({ lat: town.lat, lng: town.lng, radiusMiles: 120, limit: limit + 1 });
  return near.filter((t) => t.slug !== townSlug.toLowerCase()).slice(0, limit);
}

/** Record a search exit for the /admin/gaps demand report. Never throws. */
export async function logSearchExit(input: {
  query: string;
  townSlug?: string;
  category?: string;
  exitType: ExitType;
}): Promise<void> {
  try {
    await connectToDatabase();
    let townId: string | undefined;
    if (input.townSlug) {
      const t = await Town.findOne({ slug: input.townSlug.toLowerCase() }).select("_id");
      townId = t?._id?.toString();
    }
    await SearchExit.create({
      searchQuery: input.query,
      townId,
      category: input.category,
      exitType: input.exitType,
    });
  } catch (err) {
    console.error("logSearchExit failed (non-fatal):", err);
  }
}
