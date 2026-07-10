import { connectToDatabase } from "@/lib/db";
import { Business, type IBusiness } from "@/lib/models/Business";
import "@/lib/models/Town";
import "@/lib/models/User";

export interface AdminBusinessRow {
  id: string;
  name: string;
  slug: string;
  category?: string;
  verified: boolean;
  isActive: boolean;
  membershipTier: string;
  createdAt?: string;
  town?: { name: string; state: string; slug: string } | null;
  owner?: { email?: string; name?: string } | null;
  zip?: string;
}

/** All businesses for the admin moderation table (newest first). */
export async function getBusinessesForAdmin(): Promise<AdminBusinessRow[]> {
  await connectToDatabase();
  const rows = await Business.find({})
    .sort({ createdAt: -1 })
    .limit(300)
    .populate("townId", "name state slug")
    .populate("ownerId", "email name")
    .lean<
      (IBusiness & {
        _id: { toString(): string };
        townId?: { name: string; state: string; slug: string } | null;
        ownerId?: { email?: string; name?: string } | null;
      })[]
    >();

  return rows.map((b) => ({
    id: b._id.toString(),
    name: b.name,
    slug: b.slug,
    category: b.category,
    verified: b.verified ?? false,
    isActive: b.isActive,
    membershipTier: b.membershipTier,
    createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : undefined,
    town: b.townId ? { name: b.townId.name, state: b.townId.state, slug: b.townId.slug } : null,
    owner: b.ownerId ? { email: b.ownerId.email, name: b.ownerId.name } : null,
    zip: b.address?.zip,
  }));
}
