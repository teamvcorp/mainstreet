import { connectToDatabase } from "@/lib/db";
import { Town, type ITown } from "@/lib/models/Town";
import { Business } from "@/lib/models/Business";
import { Product } from "@/lib/models/Product";
import { Event } from "@/lib/models/Event";
import { User } from "@/lib/models/User";
import { sendEmail } from "@/lib/email";
import { buildWeeklyDigest, type DigestEvent, type DigestBusiness, type DigestProduct } from "@/emails/WeeklyDigest";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Compile the digest content for one town (events this week, shops, new arrivals). */
export async function buildDigestForTown(town: { townId: string; name: string; state: string; slug: string }) {
  await connectToDatabase();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + WEEK_MS);
  const monthAgo = new Date(now.getTime() - MONTH_MS);

  const businessIds = (
    await Business.find({ townId: town.townId, isActive: true }).select("_id").lean<{ _id: unknown }[]>()
  ).map((b) => String(b._id));

  const [events, businesses, products] = await Promise.all([
    Event.find({ townId: town.townId, isApproved: true, startAt: { $gte: now, $lte: weekAhead } })
      .sort({ startAt: 1 })
      .limit(6)
      .lean<{ title: string; startAt?: Date; locationName?: string }[]>(),
    Business.find({ townId: town.townId, isActive: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean<{ name: string; slug: string; category?: string }[]>(),
    Product.find({ businessId: { $in: businessIds }, isActive: true, createdAt: { $gte: monthAgo } })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("businessId", "slug")
      .lean<{ name: string; slug: string; priceCents: number; businessId?: { slug: string } }[]>(),
  ]);

  const digestEvents: DigestEvent[] = events.map((e) => ({
    title: e.title,
    whenLabel: e.startAt
      ? new Date(e.startAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "",
    locationName: e.locationName,
  }));
  const digestBusinesses: DigestBusiness[] = businesses.map((b) => ({ name: b.name, slug: b.slug, category: b.category }));
  const digestProducts: DigestProduct[] = products
    .filter((p) => p.businessId?.slug)
    .map((p) => ({ name: p.name, slug: p.slug, storeSlug: p.businessId!.slug, priceCents: p.priceCents }));

  return { digestEvents, digestBusinesses, digestProducts };
}

/** Emails of residents who follow a town and haven't opted out of the digest. */
async function recipientsForTown(townId: string): Promise<string[]> {
  const users = await User.find({
    followedTowns: townId,
    "notificationPrefs.townDigest": { $ne: false },
  })
    .select("email")
    .lean<{ email: string }[]>();
  return users.map((u) => u.email).filter(Boolean);
}

/**
 * Send the weekly digest to every town that has subscribers and something to
 * report. Returns a summary for the cron/admin caller.
 */
export async function sendWeeklyDigests(): Promise<{ towns: number; emails: number }> {
  await connectToDatabase();
  const towns = await Town.find({ isActive: true }).lean<(ITown & { _id: unknown })[]>();

  let townsProcessed = 0;
  let emailsSent = 0;

  for (const town of towns) {
    const townId = String(town._id);
    const recipients = await recipientsForTown(townId);
    if (recipients.length === 0) continue;

    const { digestEvents, digestBusinesses, digestProducts } = await buildDigestForTown({
      townId,
      name: town.name,
      state: town.state,
      slug: town.slug,
    });
    // Skip empty digests (nothing to say this week).
    if (digestEvents.length === 0 && digestBusinesses.length === 0 && digestProducts.length === 0) continue;

    const email = buildWeeklyDigest({
      townName: town.name,
      townState: town.state,
      townSlug: town.slug,
      events: digestEvents,
      businesses: digestBusinesses,
      products: digestProducts,
    });

    townsProcessed += 1;
    for (const to of recipients) {
      const res = await sendEmail({ to, ...email });
      if (res.sent) emailsSent += 1;
    }
  }

  return { towns: townsProcessed, emails: emailsSent };
}
