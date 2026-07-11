import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MapPin, Store, CalendarDays } from "lucide-react";
import { getTownPageData } from "@/lib/towns";
import { BusinessCard } from "@/components/business/BusinessCard";
import { EventListItem } from "@/components/events/EventListItem";
import { ShareButton } from "@/components/util/ShareButton";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, townJsonLd, eventJsonLd } from "@/lib/seo";
import { T } from "@/components/i18n/T";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTownPageData(slug).catch(() => null);
  if (!data) return { title: "Town not found" };
  const { town } = data;
  const title = `${town.name}, ${town.state} — Local Businesses & Events`;
  const description = `Discover local businesses, events, and community in ${town.name}, ${town.state}. Shop local, support your neighbors.`;
  return {
    title,
    description,
    alternates: { canonical: `/town/${town.slug}` },
    openGraph: {
      title: `${town.name} — Your Hometown Hub`,
      description,
      url: `/town/${town.slug}`,
      images: town.heroImageUrl ? [town.heroImageUrl] : undefined,
    },
  };
}

export default async function TownPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getTownPageData(slug).catch(() => null);
  if (!data) notFound();

  const { town, businesses, events } = data;

  return (
    <div>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Towns", path: "/towns" },
            { name: `${town.name}, ${town.state}`, path: `/town/${town.slug}` },
          ]),
          townJsonLd(town),
          ...events.map((e) =>
            eventJsonLd({ ...e, town: { name: town.name, state: town.state } }),
          ),
        ]}
      />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        {town.heroImageUrl ? (
          <div className="absolute inset-0">
            <Image src={town.heroImageUrl} alt="" fill priority className="object-cover" />
            <div className="absolute inset-0 bg-primary/70" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-primary to-primary/80" />
        )}
        <div className="relative mx-auto max-w-7xl px-4 py-16 text-primary-foreground sm:px-6">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium opacity-90">
            <MapPin className="size-4 text-accent" /> {town.state}
            {town.county ? ` · ${town.county} County` : ""}
            {town.population ? ` · pop. ${town.population.toLocaleString()}` : ""}
          </p>
          <h1 className="mt-2 font-serif text-5xl font-semibold">{town.name}</h1>
          {town.tagline && <p className="mt-3 max-w-2xl text-lg opacity-90">{town.tagline}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Store className="size-4 text-accent" /> {businesses.length} local{" "}
              {businesses.length === 1 ? "business" : "businesses"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-accent" /> {events.length} upcoming{" "}
              {events.length === 1 ? "event" : "events"}
            </span>
            <ShareButton title={`${town.name}, ${town.state} on MainStreet`} />
          </div>
        </div>
      </section>

      {/* Breadcrumb bar (cross-links back up to the towns directory) */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Towns", path: "/towns" },
              { name: `${town.name}, ${town.state}`, path: `/town/${town.slug}` },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3">
        {/* Businesses */}
        <section className="lg:col-span-2">
          <h2 className="font-serif text-2xl font-semibold">
            <T k="town.localBusinesses" />
          </h2>
          {businesses.length > 0 ? (
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              {businesses.map((b) => (
                <BusinessCard
                  key={b.id}
                  business={{
                    slug: b.slug,
                    name: b.name,
                    category: b.category,
                    description: b.description,
                    logoUrl: b.logoUrl,
                    bannerUrl: b.bannerUrl,
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              <T k="town.noShops" />
            </p>
          )}
        </section>

        {/* This week's events */}
        <aside className="lg:col-span-1">
          <h2 className="font-serif text-2xl font-semibold">
            <T k="town.thisWeek" />
          </h2>
          {events.length > 0 ? (
            <div className="mt-5 space-y-3">
              {events.map((e) => (
                <EventListItem
                  key={e.id}
                  event={{
                    id: e.id,
                    title: e.title,
                    category: e.category,
                    startAt: e.startAt,
                    locationName: e.locationName,
                    isFeatured: e.isFeatured,
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <T k="town.noEvents" />
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
