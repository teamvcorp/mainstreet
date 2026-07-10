"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface TownOption {
  id: string;
  name: string;
  state: string;
}

export function OnboardStartForm({ towns }: { towns: TownOption[] }) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [townId, setTownId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!townId) {
      setError("Please choose your town.");
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category: category || undefined, townId, description: description || undefined }),
    });

    if (res.status === 409) {
      // Already has a shop — just go to the dashboard.
      router.push("/seller");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create your shop.");
      setSubmitting(false);
      return;
    }

    // Refresh the JWT so role="seller" is reflected before the proxy gates /seller.
    await update();
    router.push("/seller");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label htmlFor="name">Business name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Input id="category" placeholder="bakery, hardware, boutique…" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="town">Your town</Label>
        <select
          id="town"
          value={townId}
          onChange={(e) => setTownId(e.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
        >
          <option value="">Select a town…</option>
          {towns.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}, {t.state}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Don&apos;t see your town? We&apos;re adding new towns constantly — reach out and we&apos;ll set yours up.
        </p>
      </div>
      <div>
        <Label htmlFor="description">Short description</Label>
        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Creating your shop…" : "Create my shop"}
      </Button>
    </form>
  );
}
