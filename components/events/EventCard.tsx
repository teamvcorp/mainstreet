import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone, Mail, Globe, Ticket, CalendarDays } from "lucide-react";
import type { PublicEvent } from "@/lib/events";
import { RsvpButton } from "@/components/events/RsvpButton";

const CATEGORY_LABEL: Record<string, string> = {
  festival: "Festival",
  sale: "Sale",
  sports: "Sports",
  fundraiser: "Fundraiser",
  farmers_market: "Farmers Market",
  music: "Music",
  town_hall: "Town Hall",
  school: "School",
  other: "Event",
};

function timeRange(startIso?: string, endIso?: string): string {
  if (!startIso) return "";
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const start = new Date(startIso).toLocaleTimeString("en-US", opts);
  if (!endIso) return start;
  const end = new Date(endIso).toLocaleTimeString("en-US", opts);
  return `${start} – ${end}`;
}

export function EventCard({ event }: { event: PublicEvent }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:flex-row">
      {/* Media / category */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-secondary sm:aspect-auto sm:w-48">
        {event.imageUrl ? (
          <Image src={event.imageUrl} alt="" fill className="object-cover" sizes="200px" />
        ) : (
          <div className="flex h-full min-h-32 w-full items-center justify-center bg-linear-to-br from-primary/85 to-primary/60 text-primary-foreground">
            <CalendarDays className="size-8 opacity-80" aria-hidden />
          </div>
        )}
        {event.isFeatured && (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
            Featured
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
            {CATEGORY_LABEL[event.category] ?? "Event"}
          </span>
          <span className="text-sm font-medium text-accent-foreground/80">
            {timeRange(event.startAt, event.endAt)}
          </span>
          {!event.isFree && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Ticket className="size-3" /> Ticketed
            </span>
          )}
        </div>

        <h3 className="mt-1 font-serif text-xl font-semibold leading-tight">{event.title}</h3>

        {event.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(event.locationName || event.town) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-accent" />
              {event.locationName ?? `${event.town?.name}, ${event.town?.state}`}
            </span>
          )}
          {event.business && (
            <Link href={`/store/${event.business.slug}`} className="font-medium text-foreground hover:underline">
              by {event.business.name}
            </Link>
          )}
        </div>

        {/* Business contact — pulled from the business record, not the event */}
        {event.business && (event.business.phone || event.business.email || event.business.website) && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {event.business.phone && (
              <a href={`tel:${event.business.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" /> {event.business.phone}
              </a>
            )}
            {event.business.email && (
              <a href={`mailto:${event.business.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> Email
              </a>
            )}
            {event.business.website && (
              <a href={event.business.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <Globe className="size-3.5" /> Website
              </a>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <RsvpButton eventId={event.id} initialCount={event.rsvpCount} />
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Get tickets →
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
