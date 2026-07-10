"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, X, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingEvent {
  id: string;
  title: string;
  description?: string;
  category: string;
  startAt?: string;
  locationName?: string;
  business?: { name?: string; slug?: string } | null;
  town?: { name?: string; state?: string } | null;
}

export function EventApprovalList() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading pending events…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
        <CalendarDays className="mx-auto size-8" />
        <p className="mt-2">Nothing awaiting review. 🎉</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-serif text-lg font-semibold">{e.title}</p>
              <p className="text-sm text-muted-foreground">
                {e.business?.name ?? "Unknown business"}
                {e.town ? ` · ${e.town.name}, ${e.town.state}` : ""}
                {e.startAt
                  ? ` · ${new Date(e.startAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : ""}
              </p>
              {e.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => act(e.id, "approve")} disabled={busyId === e.id}>
                <Check className="size-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => act(e.id, "reject")}
                disabled={busyId === e.id}
              >
                <X className="size-4" /> Reject
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
