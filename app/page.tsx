import type { Metadata } from "next";
import Link from "next/link";
import {
  Store,
  Search,
  Truck,
  CalendarDays,
  MapPin,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground ring-1 ring-accent/30">
            <HeartHandshake className="size-3.5" /> America&apos;s Hometown Digital Platform
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
            Your whole town,<br className="hidden sm:block" /> on one Main Street.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Discover local shops, buy from your neighbors, and keep up with everything
            happening in town — all in one trustworthy place.
          </p>

          <form
            action="/search"
            method="get"
            className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"
          >
            <Search className="ml-2 size-5 text-muted-foreground" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Try “bakery in Royal, Iowa”"
              aria-label="Search MainStreet"
              className="w-full bg-transparent px-1 text-base focus:outline-none"
            />
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/towns">
                <MapPin className="size-4" /> Explore towns
              </Link>
            </Button>
            <Button asChild variant="cta">
              <Link href="/onboard/start">
                <Store className="size-4" /> Sell your shop
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Five systems, one product */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-semibold">
          Everything a hometown needs
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
          A directory, real storefronts, built-in shipping, a community events board, and a
          public page for every town.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={<Search />} title="Local Directory" body="Find every shop in town, searchable by category, product, and place — never the open internet." />
          <FeatureCard icon={<Store />} title="Real Storefronts" body="Each business gets a beautiful online store with its story, hours, and products." />
          <FeatureCard icon={<Truck />} title="Simple Shipping" body="One flat program handles labels and delivery, so small shops can ship like the big guys." />
          <FeatureCard icon={<CalendarDays />} title="Community Events" body="Festivals, markets, games, and fundraisers — the town square, online." />
          <FeatureCard icon={<MapPin />} title="Town Pages" body="A free public front door for every town — the modern Chamber of Commerce." />
          <FeatureCard icon={<HeartHandshake />} title="Zero In-Store Cuts" body="A low annual fee, no commission on in-store sales. Built for Main Street, not against it." />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex size-11 items-center justify-center rounded-lg bg-accent/15 text-accent [&_svg]:size-5">
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
