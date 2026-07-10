"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Address-driven onboarding. We derive (and auto-create) the town from the
 * business's location — no town list to pick from. City/State/ZIP are required
 * so the shop lands in the right hometown grouping.
 */
export function OnboardStartForm() {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category: category || undefined,
        description: description || undefined,
        street: street || undefined,
        city,
        state,
        zip,
      }),
    });

    if (res.status === 409) {
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

      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Where are you located?</legend>
        <p className="mb-3 text-xs text-muted-foreground">
          We&apos;ll place your shop on your hometown&apos;s page automatically.
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="street">Street address (optional)</Label>
            <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <Label htmlFor="city">City / Town</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" maxLength={2} placeholder="IA" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} required />
            </div>
            <div>
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} required />
            </div>
          </div>
        </div>
      </fieldset>

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
