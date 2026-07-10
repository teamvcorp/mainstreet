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
import { T } from "@/components/i18n/T";
import { LocalizedSearchInput } from "@/components/i18n/LocalizedSearchInput";

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
            <HeartHandshake className="size-3.5" /> <T k="home.badge" />
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
            <T k="home.h1" />
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            <T k="home.subtitle" />
          </p>

          <form
            action="/search"
            method="get"
            className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"
          >
            <Search className="ml-2 size-5 text-muted-foreground" aria-hidden />
            <LocalizedSearchInput
              placeholderKey="home.searchPlaceholder"
              className="w-full bg-transparent px-1 text-base focus:outline-none"
            />
            <Button type="submit" size="sm">
              <T k="home.search" />
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/towns">
                <MapPin className="size-4" /> <T k="home.exploreTowns" />
              </Link>
            </Button>
            <Button asChild variant="cta">
              <Link href="/onboard/start">
                <Store className="size-4" /> <T k="home.sellShop" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Five systems, one product */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-semibold">
          <T k="home.sectionTitle" />
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
          <T k="home.sectionSub" />
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={<Search />} titleKey="home.f1t" bodyKey="home.f1b" />
          <FeatureCard icon={<Store />} titleKey="home.f2t" bodyKey="home.f2b" />
          <FeatureCard icon={<Truck />} titleKey="home.f3t" bodyKey="home.f3b" />
          <FeatureCard icon={<CalendarDays />} titleKey="home.f4t" bodyKey="home.f4b" />
          <FeatureCard icon={<MapPin />} titleKey="home.f5t" bodyKey="home.f5b" />
          <FeatureCard icon={<HeartHandshake />} titleKey="home.f6t" bodyKey="home.f6b" />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  titleKey,
  bodyKey,
}: {
  icon: React.ReactNode;
  titleKey: string;
  bodyKey: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex size-11 items-center justify-center rounded-lg bg-accent/15 text-accent [&_svg]:size-5">
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-lg font-semibold">
        <T k={titleKey} />
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        <T k={bodyKey} />
      </p>
    </div>
  );
}
