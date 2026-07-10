/**
 * DTO (Data Transfer Object) mappers.
 *
 * WHY this exists: MongoDB has no row-level security. These mappers are the
 * enforced boundary between raw DB documents and what we send to clients. They
 * exist so confidential fields (carrierCostCents, marginCents, platformFeeCents,
 * passwordHash, internal Stripe ids) can NEVER accidentally leak — a response is
 * only ever built by passing a doc through the appropriate mapper.
 *
 * Rule: seller/buyer-facing routes use the non-admin mappers. Only /api/admin/*
 * (after an admin role check) may use the *Admin* mappers.
 */
import type { IBusiness } from "@/lib/models/Business";
import type { IProduct } from "@/lib/models/Product";
import type { IOrder } from "@/lib/models/Order";
import type { IEvent } from "@/lib/models/Event";
import type { IUser } from "@/lib/models/User";

type WithId = { _id: { toString(): string } };
const id = (v: { toString(): string } | undefined | null): string | undefined =>
  v ? v.toString() : undefined;
const iso = (d: Date | undefined | null): string | undefined => (d ? d.toISOString() : undefined);

// ---- Business ----------------------------------------------------------
export function toBusinessDTO(b: IBusiness & WithId) {
  return {
    id: b._id.toString(),
    ownerId: id(b.ownerId),
    townId: id(b.townId),
    name: b.name,
    slug: b.slug,
    category: b.category,
    description: b.description,
    story: b.story,
    logoUrl: b.logoUrl,
    bannerUrl: b.bannerUrl,
    phone: b.phone,
    email: b.email,
    website: b.website,
    address: b.address,
    lat: b.lat,
    lng: b.lng,
    hours: b.hours,
    membershipTier: b.membershipTier,
    itemLimit: b.itemLimit,
    shipsOnline: b.shipsOnline,
    acceptsLocalPickup: b.acceptsLocalPickup,
    stripeAccountActive: b.stripeAccountActive,
    isActive: b.isActive,
    // NOTE: stripeAccountId intentionally omitted from client payloads.
  };
}

// ---- Product -----------------------------------------------------------
export function toProductDTO(p: IProduct & WithId) {
  return {
    id: p._id.toString(),
    businessId: id(p.businessId),
    name: p.name,
    slug: p.slug,
    description: p.description,
    priceCents: p.priceCents,
    compareAtPriceCents: p.compareAtPriceCents,
    sku: p.sku,
    inventoryQty: p.inventoryQty,
    trackInventory: p.trackInventory,
    weightOz: p.weightOz,
    dimensions: p.dimensions,
    images: p.images,
    category: p.category,
    tags: p.tags,
    isActive: p.isActive,
  };
}

// ---- Order -------------------------------------------------------------
/**
 * Buyer/seller-safe order. Deliberately EXCLUDES carrierCostCents,
 * platformFeeCents, and internal Stripe transfer ids.
 */
export function toOrderDTO(o: IOrder & WithId) {
  return {
    id: o._id.toString(),
    buyerId: id(o.buyerId),
    businessId: id(o.businessId),
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    taxCents: o.taxCents,
    totalCents: o.totalCents,
    shippingAddress: o.shippingAddress,
    carrier: o.carrier,
    service: o.service,
    trackingNumber: o.trackingNumber,
    labelUrl: o.labelUrl,
    shippedAt: iso(o.shippedAt),
    deliveredAt: iso(o.deliveredAt),
    createdAt: iso(o.createdAt),
  };
}

/**
 * Admin-only order view. Includes confidential margin fields — ONLY call after
 * verifying the requester's role is "admin", and only when the doc was queried
 * with `.select('+carrierCostCents +platformFeeCents')`.
 */
export function toAdminOrderDTO(o: IOrder & WithId) {
  return {
    ...toOrderDTO(o),
    carrierCostCents: o.carrierCostCents,
    platformFeeCents: o.platformFeeCents,
    stripePaymentIntentId: o.stripePaymentIntentId,
    stripeTransferId: o.stripeTransferId,
  };
}

// ---- Event -------------------------------------------------------------
export function toEventDTO(e: IEvent & WithId) {
  return {
    id: e._id.toString(),
    townId: id(e.townId),
    businessId: id(e.businessId),
    title: e.title,
    description: e.description,
    category: e.category,
    startAt: iso(e.startAt),
    endAt: iso(e.endAt),
    locationName: e.locationName,
    address: e.address,
    imageUrl: e.imageUrl,
    isFree: e.isFree,
    ticketUrl: e.ticketUrl,
    rsvpCount: e.rsvpCount,
    isFeatured: e.isFeatured,
  };
}

// ---- User (self) -------------------------------------------------------
/** Safe self view. Never includes passwordHash (also select:false in schema). */
export function toUserDTO(u: IUser & WithId) {
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    townId: id(u.townId),
    image: u.image,
    favorites: (u.favorites ?? []).map((f) => f.toString()),
    followedTowns: (u.followedTowns ?? []).map((t) => t.toString()),
    savedAddresses: u.savedAddresses ?? [],
    notificationPrefs: u.notificationPrefs,
  };
}
