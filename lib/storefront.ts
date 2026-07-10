import { connectToDatabase } from "@/lib/db";
import { Business, type IBusiness } from "@/lib/models/Business";
import { Product, type IProduct } from "@/lib/models/Product";

type Lean<T> = T & { _id: { toString(): string } };
type PopTown = { name: string; state: string; slug: string };

function businessView(b: Lean<IBusiness> & { townId?: PopTown }) {
  return {
    id: b._id.toString(),
    slug: b.slug,
    name: b.name,
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
    shipsOnline: b.shipsOnline,
    acceptsLocalPickup: b.acceptsLocalPickup,
    town: b.townId ? { name: b.townId.name, state: b.townId.state, slug: b.townId.slug } : undefined,
  };
}

function productView(p: Lean<IProduct>) {
  return {
    id: p._id.toString(),
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    compareAtPriceCents: p.compareAtPriceCents,
    inventoryQty: p.inventoryQty,
    trackInventory: p.trackInventory,
    weightOz: p.weightOz,
    images: p.images ?? [],
    category: p.category,
    tags: p.tags ?? [],
  };
}

export type StorefrontBusiness = ReturnType<typeof businessView>;
export type StorefrontProduct = ReturnType<typeof productView>;

/** Public storefront: the business + its active products. Null if not found. */
export async function getStorefront(slug: string) {
  await connectToDatabase();
  const biz = await Business.findOne({ slug: slug.toLowerCase(), isActive: true })
    .populate("townId", "name state slug")
    .lean<Lean<IBusiness> & { townId?: PopTown }>();
  if (!biz) return null;

  const products = await Product.find({ businessId: biz._id, isActive: true })
    .sort({ createdAt: -1 })
    .limit(60)
    .lean<Lean<IProduct>[]>();

  return { business: businessView(biz), products: products.map(productView) };
}

/** A single product page: business + product + a few related products. */
export async function getProductPage(storeSlug: string, productSlug: string) {
  await connectToDatabase();
  const biz = await Business.findOne({ slug: storeSlug.toLowerCase(), isActive: true })
    .populate("townId", "name state slug")
    .lean<Lean<IBusiness> & { townId?: PopTown }>();
  if (!biz) return null;

  const product = await Product.findOne({
    businessId: biz._id,
    slug: productSlug.toLowerCase(),
    isActive: true,
  }).lean<Lean<IProduct>>();
  if (!product) return null;

  const related = await Product.find({
    businessId: biz._id,
    isActive: true,
    _id: { $ne: product._id },
  })
    .sort({ createdAt: -1 })
    .limit(4)
    .lean<Lean<IProduct>[]>();

  return {
    business: businessView(biz),
    product: productView(product),
    related: related.map(productView),
  };
}

/** Active storefront slugs for generateStaticParams / sitemap. */
export async function getActiveStorefrontSlugs(): Promise<string[]> {
  await connectToDatabase();
  const rows = await Business.find({ isActive: true }).select("slug").lean<{ slug: string }[]>();
  return rows.map((r) => r.slug);
}
