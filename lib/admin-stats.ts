import { connectToDatabase } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { Business } from "@/lib/models/Business";
import { Town } from "@/lib/models/Town";
import { SearchExit } from "@/lib/models/SearchExit";
import { BusinessSuggestion } from "@/lib/models/BusinessSuggestion";
import { User } from "@/lib/models/User";
import { PAID_TIERS } from "@/lib/membership";

const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"];

export interface PlatformStats {
  revenueCents: number; // gross collected on paid orders
  gmvCents: number; // product subtotal (seller earnings)
  shippingCents: number; // consumer shipping collected
  marginCents: number; // shipping spread (platform profit)
  orders: number;
  activeMembers: number;
  businesses: number;
  towns: number;
  pendingSuggestions: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  await connectToDatabase();
  const agg = await Order.aggregate<{
    revenueCents: number;
    gmvCents: number;
    shippingCents: number;
    marginCents: number;
    orders: number;
  }>([
    { $match: { status: { $in: PAID_STATUSES } } },
    {
      $group: {
        _id: null,
        revenueCents: { $sum: "$totalCents" },
        gmvCents: { $sum: "$subtotalCents" },
        shippingCents: { $sum: "$shippingCents" },
        marginCents: { $sum: "$platformFeeCents" },
        orders: { $sum: 1 },
      },
    },
  ]);
  const now = new Date();
  const [activeMembers, businesses, towns, pendingSuggestions] = await Promise.all([
    Business.countDocuments({
      membershipTier: { $in: PAID_TIERS },
      $or: [{ membershipExpiresAt: null }, { membershipExpiresAt: { $gte: now } }, { membershipExpiresAt: { $exists: false } }],
    }),
    Business.countDocuments({}),
    Town.countDocuments({ isActive: true }),
    BusinessSuggestion.countDocuments({ status: "pending" }),
  ]);

  const a = agg[0];
  return {
    revenueCents: a?.revenueCents ?? 0,
    gmvCents: a?.gmvCents ?? 0,
    shippingCents: a?.shippingCents ?? 0,
    marginCents: a?.marginCents ?? 0,
    orders: a?.orders ?? 0,
    activeMembers,
    businesses,
    towns,
    pendingSuggestions,
  };
}

export interface GapRow {
  query: string;
  townName?: string;
  count: number;
  amazonExits: number;
}

/** Unmet-demand report: searches that exited (Addendum A → /admin/gaps). */
export async function getSearchGaps(): Promise<GapRow[]> {
  await connectToDatabase();
  const rows = await SearchExit.aggregate<{
    _id: { q: string; town: unknown };
    count: number;
    amazon: number;
    town: { name?: string; state?: string }[];
  }>([
    {
      $group: {
        _id: { q: { $toLower: "$searchQuery" }, town: "$townId" },
        count: { $sum: 1 },
        amazon: { $sum: { $cond: [{ $eq: ["$exitType", "amazon"] }, 1, 0] } },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 100 },
    { $lookup: { from: "towns", localField: "_id.town", foreignField: "_id", as: "town" } },
  ]);

  return rows.map((r) => ({
    query: r._id.q,
    townName: r.town?.[0] ? `${r.town[0].name}, ${r.town[0].state}` : undefined,
    count: r.count,
    amazonExits: r.amazon,
  }));
}

export interface SuggestionRow {
  id: string;
  businessName: string;
  category?: string;
  phone?: string;
  website?: string;
  searchQuery?: string;
  status: string;
  townName?: string;
  createdAt?: string;
}

export async function getSuggestionsList(): Promise<SuggestionRow[]> {
  await connectToDatabase();
  const rows = await BusinessSuggestion.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("townId", "name state")
    .lean<
      {
        _id: { toString(): string };
        businessName: string;
        category?: string;
        phone?: string;
        website?: string;
        searchQuery?: string;
        status: string;
        createdAt?: Date;
        townId?: { name: string; state: string };
      }[]
    >();
  return rows.map((s) => ({
    id: s._id.toString(),
    businessName: s.businessName,
    category: s.category,
    phone: s.phone,
    website: s.website,
    searchQuery: s.searchQuery,
    status: s.status,
    townName: s.townId ? `${s.townId.name}, ${s.townId.state}` : undefined,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : undefined,
  }));
}

export interface AdminUserRow {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt?: string;
}

export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  await connectToDatabase();
  const rows = await User.find({})
    .sort({ createdAt: -1 })
    .limit(300)
    .select("email name role createdAt")
    .lean<{ _id: { toString(): string }; email: string; name?: string; role: string; createdAt?: Date }[]>();
  return rows.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
  }));
}

export interface AdminTownRow {
  id: string;
  name: string;
  state: string;
  slug: string;
  tagline?: string;
  heroImageUrl?: string;
  isActive: boolean;
  autoCreated: boolean;
  businessCount: number;
}

export async function listTownsForAdmin(): Promise<AdminTownRow[]> {
  await connectToDatabase();
  const towns = await Town.find({})
    .sort({ name: 1 })
    .limit(500)
    .lean<
      {
        _id: { toString(): string };
        name: string;
        state: string;
        slug: string;
        tagline?: string;
        heroImageUrl?: string;
        isActive: boolean;
        autoCreated?: boolean;
      }[]
    >();
  const counts = await Business.aggregate<{ _id: unknown; n: number }>([
    { $match: { isActive: true } },
    { $group: { _id: "$townId", n: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  return towns.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    state: t.state,
    slug: t.slug,
    tagline: t.tagline,
    heroImageUrl: t.heroImageUrl,
    isActive: t.isActive,
    autoCreated: t.autoCreated ?? false,
    businessCount: map.get(t._id.toString()) ?? 0,
  }));
}
