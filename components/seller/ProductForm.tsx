"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/seller/ImageUpload";

export interface ProductInitial {
  id?: string;
  name?: string;
  description?: string;
  priceCents?: number;
  compareAtPriceCents?: number;
  sku?: string;
  inventoryQty?: number;
  trackInventory?: boolean;
  weightOz?: number;
  dimensions?: { lengthIn?: number; widthIn?: number; heightIn?: number };
  images?: string[];
  category?: string;
  tags?: string[];
}

const dollars = (cents?: number) => (typeof cents === "number" ? (cents / 100).toString() : "");

export function ProductForm({ initial = {} }: { initial?: ProductInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);

  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [price, setPrice] = useState(dollars(initial.priceCents));
  const [compare, setCompare] = useState(dollars(initial.compareAtPriceCents));
  const [sku, setSku] = useState(initial.sku ?? "");
  const [inventoryQty, setInventoryQty] = useState((initial.inventoryQty ?? 0).toString());
  const [trackInventory, setTrackInventory] = useState(initial.trackInventory ?? true);
  const [weightOz, setWeightOz] = useState(initial.weightOz?.toString() ?? "");
  const [lengthIn, setLengthIn] = useState(initial.dimensions?.lengthIn?.toString() ?? "");
  const [widthIn, setWidthIn] = useState(initial.dimensions?.widthIn?.toString() ?? "");
  const [heightIn, setHeightIn] = useState(initial.dimensions?.heightIn?.toString() ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [tagsText, setTagsText] = useState((initial.tags ?? []).join(", "));
  const [images, setImages] = useState<string[]>(initial.images ?? []);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function num(v: string): number | undefined {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const dims =
      lengthIn || widthIn || heightIn
        ? { lengthIn: num(lengthIn), widthIn: num(widthIn), heightIn: num(heightIn) }
        : undefined;

    const payload = {
      name,
      description: description || undefined,
      priceCents: Math.round((num(price) ?? 0) * 100),
      compareAtPriceCents: compare ? Math.round((num(compare) ?? 0) * 100) : undefined,
      sku: sku || undefined,
      inventoryQty: parseInt(inventoryQty || "0", 10),
      trackInventory,
      weightOz: weightOz ? num(weightOz) : undefined,
      dimensions: dims,
      images,
      category: category || undefined,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    const res = await fetch(isEdit ? `/api/products/${initial.id}` : "/api/products", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save product.");
      setSaving(false);
      return;
    }
    router.push("/seller/products");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      {/* Images */}
      <div>
        <Label>Photos</Label>
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((url) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-border">
              <Image src={url} alt="" fill className="object-cover" sizes="120px" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {images.length < 8 && (
            <div className="aspect-square">
              <ImageUpload
                value={undefined}
                onChange={(url) => url && setImages((prev) => [...prev, url])}
                aspect="aspect-square"
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="name">Product name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Price (USD)</Label>
          <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="compare">Compare-at price (optional)</Label>
          <Input id="compare" inputMode="decimal" value={compare} onChange={(e) => setCompare(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sku">SKU (optional)</Label>
          <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="inventory">Inventory quantity</Label>
          <Input id="inventory" inputMode="numeric" value={inventoryQty} onChange={(e) => setInventoryQty(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-accent" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} />
        Track inventory (hide when out of stock)
      </label>

      {/* Shipping dims — used to quote rates at checkout */}
      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Shipping details</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="weight">Weight (oz)</Label>
            <Input id="weight" inputMode="decimal" value={weightOz} onChange={(e) => setWeightOz(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="len">Length (in)</Label>
            <Input id="len" inputMode="decimal" value={lengthIn} onChange={(e) => setLengthIn(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="wid">Width (in)</Label>
            <Input id="wid" inputMode="decimal" value={widthIn} onChange={(e) => setWidthIn(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="hei">Height (in)</Label>
            <Input id="hei" inputMode="decimal" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save product" : "Add product"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/seller/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
