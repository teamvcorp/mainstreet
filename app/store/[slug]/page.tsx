import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone, Mail, Globe, Store as StoreIcon, Truck, ShoppingBag } from "lucide-react";
import { getStorefront, getActiveStorefrontSlugs } from "@/lib/storefront";
import { ProductCard } from "@/components/product/ProductCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, localBusinessJsonLd } from "@/lib/seo";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const slugs = await getActiveStorefrontSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefront(slug).catch(() => null);
  if (!data) return { title: "Shop not found" };
  const { business: b } = data;
  const title = `${b.name}${b.town ? ` — ${b.town.name}, ${b.town.state}` : ""}`;
  const description = b.description ?? `Shop ${b.name} on MainStreet. Support local, shop small.`;
  return {
    title,
    description,
    alternates: { canonical: `/store/${b.slug}` },
    openGraph: {
      title: b.name,
      description,
      url: `/store/${b.slug}`,
      images: b.bannerUrl ? [b.bannerUrl] : b.logoUrl ? [b.logoUrl] : undefined,
    },
  };
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getStorefront(slug).catch(() => null);
  if (!data) notFound();
  const { business: b, products } = data;

  const crumbs = [
    { name: "Home", path: "/" },
    ...(b.town ? [{ name: `${b.town.name}, ${b.town.state}`, path: `/town/${b.town.slug}` }] : []),
    { name: b.name, path: `/store/${b.slug}` },
  ];

  return (
    <div>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          localBusinessJsonLd({
            name: b.name,
            slug: b.slug,
            description: b.description,
            logoUrl: b.logoUrl,
            phone: b.phone,
            website: b.website,
            address: b.address,
            lat: b.lat,
            lng: b.lng,
          }),
        ]}
      />

      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden bg-secondary sm:h-60">
        {b.bannerUrl ? (
          <Image src={b.bannerUrl} alt="" fill priority className="object-cover" />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-primary to-primary/70" />
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Identity */}
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border-4 border-background bg-card shadow">
            {b.logoUrl ? (
              <Image src={b.logoUrl} alt={b.name} fill sizes="96px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                <StoreIcon className="size-8" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-3xl font-semibold">{b.name}</h1>
            <p className="text-sm text-muted-foreground">
              {b.category ? `${b.category} · ` : ""}
              {b.town && (
                <Link href={`/town/${b.town.slug}`} className="hover:text-foreground hover:underline">
                  {b.town.name}, {b.town.state}
                </Link>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Breadcrumbs items={crumbs} />
        </div>

        <div className="mt-6 grid gap-10 py-6 lg:grid-cols-3">
          {/* Products */}
          <section className="lg:col-span-2">
            <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">
              <ShoppingBag className="size-5 text-accent" /> Products
            </h2>
            {products.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={{
                      slug: p.slug,
                      storeSlug: b.slug,
                      name: p.name,
                      priceCents: p.priceCents,
                      compareAtPriceCents: p.compareAtPriceCents,
                      images: p.images,
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                This shop hasn&apos;t listed products yet.
              </p>
            )}
          </section>

          {/* About + contact */}
          <aside className="space-y-6">
            {b.story && (
              <div>
                <h3 className="font-serif text-lg font-semibold">Our story</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{b.story}</p>
              </div>
            )}
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <h3 className="font-serif text-base font-semibold">Visit &amp; contact</h3>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                {b.address?.street && (
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 text-accent" />
                    <span>
                      {b.address.street}
                      {b.address.city ? `, ${b.address.city}` : ""} {b.address.state} {b.address.zip}
                    </span>
                  </li>
                )}
                {b.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="size-4 text-accent" />
                    <a href={`tel:${b.phone}`} className="hover:text-foreground">{b.phone}</a>
                  </li>
                )}
                {b.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="size-4 text-accent" />
                    <a href={`mailto:${b.email}`} className="hover:text-foreground">{b.email}</a>
                  </li>
                )}
                {b.website && (
                  <li className="flex items-center gap-2">
                    <Globe className="size-4 text-accent" />
                    <a href={b.website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                      Website
                    </a>
                  </li>
                )}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {b.shipsOnline && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-success">
                    <Truck className="size-3.5" /> Ships online
                  </span>
                )}
                {b.acceptsLocalPickup && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                    <MapPin className="size-3.5" /> Local pickup
                  </span>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
