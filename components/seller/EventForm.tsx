"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/seller/ImageUpload";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABEL as CATEGORY_LABEL } from "@/lib/event-categories";

export function EventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("festival");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [isFree, setIsFree] = useState(true);
  const [ticketUrl, setTicketUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPendingMsg(null);
    if (!startAt) {
      setError("Please choose a start date and time.");
      return;
    }
    setSaving(true);

    const payload = {
      title,
      description: description || undefined,
      category,
      startAt: new Date(startAt).toISOString(),
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
      locationName: locationName || undefined,
      imageUrl: imageUrl || undefined,
      isFree,
      ticketUrl: ticketUrl || undefined,
    };

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Could not post your event.");
      setSaving(false);
      return;
    }
    if (data.pending) {
      setPendingMsg(data.reason ?? "Your event was submitted and is awaiting admin approval.");
      setSaving(false);
      return;
    }
    router.push("/seller/events");
    router.refresh();
  }

  if (pendingMsg) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" />
          <h2 className="font-serif text-lg font-semibold">Submitted for review</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{pendingMsg}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll publish it as soon as an admin approves it.
        </p>
        <Button className="mt-4" onClick={() => router.push("/seller/events")}>
          Back to my events
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" />
        Your business name and contact details are pulled from your store profile automatically. Here
        you only set the event name and details.
      </p>

      <ImageUpload label="Event photo (optional)" value={imageUrl} onChange={setImageUrl} />

      <div>
        <Label htmlFor="title">Event name</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      </div>

      <div>
        <Label htmlFor="description">Details</Label>
        <Textarea id="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c] ?? c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="location">Location name (optional)</Label>
          <Input id="location" placeholder="e.g. Town Square" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="start">Starts</Label>
          <Input id="start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="end">Ends (optional)</Label>
          <Input id="end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-accent" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        Free to attend
      </label>

      {!isFree && (
        <div>
          <Label htmlFor="ticket">Ticket URL</Label>
          <Input id="ticket" placeholder="https://" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Posting…" : "Post event"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/seller/events")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
