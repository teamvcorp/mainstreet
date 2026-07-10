"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Optimistic RSVP toggle. If the user isn't signed in, the API returns 401 and
 * we bounce them to login (preserving the events page as the return target).
 */
export function RsvpButton({
  eventId,
  initialCount,
}: {
  eventId: string;
  initialCount: number;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [rsvped, setRsvped] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, { method: "POST" });
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/events")}`);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setRsvped(data.rsvped);
      setCount(data.rsvpCount);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        rsvped
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border hover:bg-muted",
      )}
      aria-pressed={rsvped}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Heart className={cn("size-4", rsvped && "fill-current")} />
      )}
      {count > 0 ? count : ""} {rsvped ? "Going" : "RSVP"}
    </button>
  );
}
