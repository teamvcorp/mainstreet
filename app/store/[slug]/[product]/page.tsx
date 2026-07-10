import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Truck, MapPin, Package } from "lucide-react";
import { getProductPage } from "@/lib/storefront";
import { ProductCard } from "@/components/product/ProductCard";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import { formatCurrency } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}): Promise<Metadata> {
  const { slug, product } = await params;
  const data = await getProductPage(slug, product).catch(() => null);
  if (!data) return { title: "Product not found" };
  const { business: b, product: p } = data;
  const description = p.description ?? `${p.name} from ${b.name} on MainStreet.`;
  return {
    title: `${p.name} — ${b.name}`,
    description,
    alternates: { canonical: `/store/${b.slug}/${p.slug}` },
    openGraph: {
      title: p.name,
      description,
      url: `/store/${b.slug}/${p.slug}`,
      images: p.images.length ? [p.images[0]] : b.logoUrl ? [b.logoUrl] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}) {
  const { slug, product } = await params;
  const data = await getProductPage(slug, product).catch(() => null);
  if (!data) notFound();
  const { business: b, product: p, related } = data;

  const outOfStock = p.trackInventory && p.inventoryQty <= 0;
  const onSale = typeof p.compareAtPriceCents === "number" && p.compareAtPriceCents > p.priceCents;

  const crumbs = [
    { name: "Home", path: "/" },
    ...(b.town ? [{ name: `${b.town.name}, ${b.town.state}`, path: `/town/${b.town.slug}` }] : []),
    { name: b.name, path: `/store/${b.slug}` },
    { name: p.name, path: `/store/${b.slug}/${p.slug}` },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          productJsonLd({
            name: p.name,
            description: p.description,
            images: p.images,
            priceCents: p.priceCents,
            storeName: b.name,
            url: `/store/${b.slug}/${p.slug}`,
            inStock: !outOfStock,
          }),
        ]}
      />
      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-secondary">
            {p.images[0] ? (
              <Image src={p.images[0]} alt={p.name} fill priority sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Package className="size-12 opacity-60" />
              </div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {p.images.slice(0, 5).map((img) => (
                <div key={img} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                  <Image src={img} alt="" fill sizes="80px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <Link href={`/store/${b.slug}`} className="text-sm font-medium text-accent-foreground/80 hover:underline">
            {b.name}
          </Link>
          <h1 className="mt-1 font-serif text-3xl font-semibold">{p.name}</h1>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-2xl font-semibold">{formatCurrency(p.priceCents)}</span>
            {onSale && (
              <span className="text-muted-foreground line-through">
                {formatCurrency(p.compareAtPriceCents!)}
              </span>
            )}
          </div>

          {p.description && (
            <p className="mt-4 whitespace-pre-line text-muted-foreground">{p.description}</p>
          )}

          <div className="mt-6">
            <AddToCartButton
              outOfStock={outOfStock}
              item={{
                productId: p.id,
                businessId: b.id,
                businessName: b.name,
                businessSlug: b.slug,
                name: p.name,
                slug: p.slug,
                priceCents: p.priceCents,
                weightOz: p.weightOz,
                imageUrl: p.images[0],
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {b.shipsOnline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-success">
                <Truck className="size-3.5" /> Ships from {b.town?.name ?? "the shop"}
              </span>
            )}
            {b.acceptsLocalPickup && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                <MapPin className="size-3.5" /> Local pickup available
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-serif text-xl font-semibold">More from {b.name}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((r) => (
              <ProductCard
                key={r.id}
                product={{
                  slug: r.slug,
                  storeSlug: b.slug,
                  name: r.name,
                  priceCents: r.priceCents,
                  compareAtPriceCents: r.compareAtPriceCents,
                  images: r.images,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
