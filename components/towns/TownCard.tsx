import Link from "next/link";
import Image from "next/image";
import { MapPin, Store, CalendarDays, Navigation } from "lucide-react";
import type { TownListItem } from "@/lib/towns";

export function TownCard({ town }: { town: TownListItem }) {
  return (
    <Link
      href={`/town/${town.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
        {town.heroImageUrl ? (
          <Image
            src={town.heroImageUrl}
            alt={`${town.name}, ${town.state}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/90 to-primary/60 text-primary-foreground">
            <MapPin className="size-8 opacity-80" aria-hidden />
          </div>
        )}
        {typeof town.distanceMiles === "number" && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            <Navigation className="size-3 text-accent" aria-hidden />
            {town.distanceMiles} mi
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold leading-tight">{town.name}</h3>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {town.state}
          </span>
        </div>
        {town.tagline && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{town.tagline}</p>
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Store className="size-3.5 text-accent" aria-hidden />
            {town.businessCount} {town.businessCount === 1 ? "shop" : "shops"}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5 text-accent" aria-hidden />
            {town.upcomingEventCount} {town.upcomingEventCount === 1 ? "event" : "events"}
          </span>
        </div>
      </div>
    </Link>
  );
}
