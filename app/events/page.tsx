import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { getPublicEvents, type PublicEvent } from "@/lib/events";
import { EVENT_CATEGORIES } from "@/lib/event-categories";
import { EventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, eventJsonLd } from "@/lib/seo";
import { T } from "@/components/i18n/T";

export const metadata: Metadata = {
  title: "Community events",
  description: "Festivals, markets, music, and more happening across small-town America.",
  alternates: { canonical: "/events" },
};

export const revalidate = 120;

const CATEGORY_LABEL: Record<string, string> = {
  festival: "Festivals",
  sale: "Sales",
  sports: "Sports",
  fundraiser: "Fundraisers",
  farmers_market: "Farmers Markets",
  music: "Music",
  town_hall: "Town Hall",
  school: "School",
  other: "Other",
};

function groupByDate(events: PublicEvent[]): [string, PublicEvent[]][] {
  const groups = new Map<string, PublicEvent[]>();
  for (const e of [...events].sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""))) {
    const label = e.startAt
      ? new Date(e.startAt).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : "Upcoming";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(e);
  }
  return [...groups.entries()];
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; town?: string }>;
}) {
  const { category, town } = await searchParams;
  let events: PublicEvent[] = [];
  try {
    events = await getPublicEvents({ category, townSlug: town });
  } catch (err) {
    console.error("EventsPage: could not load events —", err);
  }
  const grouped = groupByDate(events);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
          ]),
          ...events.map((e) => eventJsonLd(e)),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Events", path: "/events" },
        ]}
      />
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold">
            <T k="events.title" />
          </h1>
          <p className="mt-1 text-muted-foreground">
            <T k="events.subtitle" />
            {town ? ` · ${town}` : ""}.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/seller/events/new">
            <Plus className="size-4" /> <T k="events.postEvent" />
          </Link>
        </Button>
      </header>

      {/* Category filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        <FilterPill href={buildHref({ town })} active={!category} labelNode={<T k="events.all" />} />
        {EVENT_CATEGORIES.map((c) => (
          <FilterPill
            key={c}
            href={buildHref({ town, category: c })}
            active={category === c}
            label={CATEGORY_LABEL[c] ?? c}
          />
        ))}
      </div>

      {/* Feed */}
      {grouped.length > 0 ? (
        <div className="mt-8 space-y-10">
          {grouped.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-3 font-serif text-lg font-semibold text-muted-foreground">{date}</h2>
              <div className="space-y-4">
                {items.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center">
          <CalendarDays className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-serif text-lg">
            <T k={category ? "events.noneCat" : "events.none"} />
          </p>
          <p className="text-sm text-muted-foreground">
            <T k="events.noneBody" />
          </p>
        </div>
      )}
    </div>
  );
}

function buildHref(params: { town?: string; category?: string }): string {
  const sp = new URLSearchParams();
  if (params.town) sp.set("town", params.town);
  if (params.category) sp.set("category", params.category);
  const qs = sp.toString();
  return qs ? `/events?${qs}` : "/events";
}

function FilterPill({
  href,
  active,
  label,
  labelNode,
}: {
  href: string;
  active: boolean;
  label?: string;
  labelNode?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
      )}
    >
      {labelNode ?? label}
    </Link>
  );
}
