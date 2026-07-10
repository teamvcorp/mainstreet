import { CalendarDays, MapPin } from "lucide-react";

export interface EventListItemData {
  id: string;
  title: string;
  category: string;
  startAt?: string;
  locationName?: string;
  isFeatured?: boolean;
}

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

function formatWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventListItem({ event }: { event: EventListItemData }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <CalendarDays className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
            {CATEGORY_LABEL[event.category] ?? "Event"}
          </span>
          {event.isFeatured && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
              Featured
            </span>
          )}
        </div>
        <h4 className="mt-1 truncate font-medium">{event.title}</h4>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{formatWhen(event.startAt)}</span>
          {event.locationName && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden /> {event.locationName}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
