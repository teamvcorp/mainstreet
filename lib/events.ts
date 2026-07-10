import { connectToDatabase } from "@/lib/db";
import { Event, type IEvent } from "@/lib/models/Event";
import { Town } from "@/lib/models/Town";
import "@/lib/models/Business"; // ensure Business schema is registered for populate

export interface PublicEvent {
  id: string;
  title: string;
  description?: string;
  category: string;
  startAt?: string;
  endAt?: string;
  locationName?: string;
  imageUrl?: string;
  isFree: boolean;
  ticketUrl?: string;
  rsvpCount: number;
  isFeatured: boolean;
  town?: { name: string; state: string; slug: string };
  business?: {
    name: string;
    slug: string;
    phone?: string;
    email?: string;
    website?: string;
  } | null;
}

interface PopulatedEvent extends Omit<IEvent, "townId" | "businessId" | "_id"> {
  _id: { toString(): string };
  townId?: { name: string; state: string; slug: string } | null;
  businessId?: {
    name: string;
    slug: string;
    phone?: string;
    email?: string;
    website?: string;
  } | null;
}

function toPublicEvent(e: PopulatedEvent): PublicEvent {
  return {
    id: e._id.toString(),
    title: e.title,
    description: e.description,
    category: e.category,
    startAt: e.startAt ? new Date(e.startAt).toISOString() : undefined,
    endAt: e.endAt ? new Date(e.endAt).toISOString() : undefined,
    locationName: e.locationName,
    imageUrl: e.imageUrl,
    isFree: e.isFree,
    ticketUrl: e.ticketUrl,
    rsvpCount: e.rsvpCount ?? 0,
    isFeatured: e.isFeatured ?? false,
    town: e.townId ? { name: e.townId.name, state: e.townId.state, slug: e.townId.slug } : undefined,
    business: e.businessId
      ? {
          name: e.businessId.name,
          slug: e.businessId.slug,
          phone: e.businessId.phone,
          email: e.businessId.email,
          website: e.businessId.website,
        }
      : null,
  };
}

export interface EventFilters {
  townSlug?: string;
  category?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

/** Approved, upcoming events for the public feed / town pages. */
export async function getPublicEvents(filters: EventFilters = {}): Promise<PublicEvent[]> {
  await connectToDatabase();
  const limit = Math.min(filters.limit ?? 60, 200);

  const query: Record<string, unknown> = { isApproved: true };
  const startAt: Record<string, Date> = { $gte: filters.from ?? new Date() };
  if (filters.to) startAt.$lte = filters.to;
  query.startAt = startAt;
  if (filters.category) query.category = filters.category;

  if (filters.townSlug) {
    const town = await Town.findOne({ slug: filters.townSlug.toLowerCase() }).select("_id");
    if (!town) return [];
    query.townId = town._id;
  }

  const events = await Event.find(query)
    .sort({ isFeatured: -1, startAt: 1 })
    .limit(limit)
    .populate("businessId", "name slug phone email website")
    .populate("townId", "name state slug")
    .lean<PopulatedEvent[]>();

  return events.map(toPublicEvent);
}

/** All of a business's events (any status) for the seller dashboard. */
export async function getBusinessEvents(businessId: string) {
  await connectToDatabase();
  return Event.find({ businessId })
    .sort({ startAt: 1 })
    .lean<(IEvent & { _id: { toString(): string } })[]>();
}
