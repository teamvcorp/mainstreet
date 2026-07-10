"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Edit is limited to name + details (per product rules). */
export function EventEditForm({
  eventId,
  initialTitle,
  initialDescription,
}: {
  eventId: string;
  initialTitle: string;
  initialDescription?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not save changes.");
      setSaving(false);
      return;
    }
    router.push("/seller/events");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <div>
        <Label htmlFor="title">Event name</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      </div>
      <div>
        <Label htmlFor="description">Details</Label>
        <Textarea id="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/seller/events")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
