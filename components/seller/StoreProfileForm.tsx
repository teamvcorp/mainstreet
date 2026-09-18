"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateBusinessRefined, type UpdateBusinessInput } from "@/schemas/business";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/seller/ImageUpload";

export interface StoreProfileInitial {
  id: string;
  name?: string;
  category?: string;
  description?: string;
  story?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  logoUrl?: string;
  bannerUrl?: string;
  shipsOnline?: boolean;
  acceptsLocalPickup?: boolean;
  shipMode?: "self_ship" | "pickup_pack";
}

export function StoreProfileForm({ initial }: { initial: StoreProfileInitial }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | undefined>(initial.logoUrl);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(initial.bannerUrl);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<UpdateBusinessInput>({
    resolver: zodResolver(updateBusinessRefined),
    defaultValues: {
      name: initial.name,
      category: initial.category,
      description: initial.description,
      story: initial.story,
      phone: initial.phone,
      email: initial.email ?? "",
      website: initial.website ?? "",
      address: initial.address ?? {},
      shipsOnline: initial.shipsOnline,
      acceptsLocalPickup: initial.acceptsLocalPickup,
      shipMode: initial.shipMode ?? "pickup_pack",
    },
  });

  async function onSubmit(values: UpdateBusinessInput) {
    setFormError(null);
    setSaved(false);
    const res = await fetch(`/api/businesses/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, logoUrl, bannerUrl }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? "Could not save changes.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Branding */}
      <section className="grid gap-4 sm:grid-cols-2">
        <ImageUpload label="Logo" value={logoUrl} onChange={setLogoUrl} aspect="aspect-square" />
        <ImageUpload label="Banner" value={bannerUrl} onChange={setBannerUrl} aspect="aspect-[16/9]" />
      </section>

      {/* Basics */}
      <section className="space-y-4">
        <div>
          <Label htmlFor="name">Store name</Label>
          <Input id="name" {...register("name")} />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" placeholder="bakery, hardware, boutique…" {...register("category")} />
        </div>
        <div>
          <Label htmlFor="description">Short description</Label>
          <Textarea id="description" rows={2} {...register("description")} />
        </div>
        <div>
          <Label htmlFor="story">Your story</Label>
          <Textarea id="story" rows={5} placeholder="Tell customers what makes your shop special." {...register("story")} />
        </div>
      </section>

      {/* Contact */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
        </div>
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" placeholder="https://" {...register("website")} />
        </div>
      </section>

      {/* Address (geocoded server-side for maps + shipping origin) */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="street">Street address</Label>
          <Input id="street" {...register("address.street")} />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" {...register("address.city")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" maxLength={2} {...register("address.state")} />
          </div>
          <div>
            <Label htmlFor="zip">ZIP</Label>
            <Input id="zip" {...register("address.zip")} />
          </div>
        </div>
      </section>

      {/* Fulfillment */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-accent" {...register("shipsOnline")} />
          Ships online (via MainStreet shipping)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-accent" {...register("acceptsLocalPickup")} />
          Offers local pickup
        </label>

        {/*
          How a sold item reaches the carrier. This changes the buyer's price, because
          the pack-and-ship option includes Storm Lake's packing fee in the quoted rate.
        */}
        <fieldset className="mt-4 space-y-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">When something sells</legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              value="pickup_pack"
              className="mt-0.5 size-4 accent-accent"
              {...register("shipMode")}
            />
            <span>
              <span className="font-medium">We pick it up and ship it</span>
              <span className="block text-xs text-muted-foreground">
                Storm Lake Pack &amp; Ship collects the item, packs it, and ships it. Nothing
                for you to do. Packing is included in the shipping the buyer pays.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              value="self_ship"
              className="mt-0.5 size-4 accent-accent"
              {...register("shipMode")}
            />
            <span>
              <span className="font-medium">Email me a shipping label</span>
              <span className="block text-xs text-muted-foreground">
                You pack it and hand it to the carrier. The label is emailed to your
                business email as soon as the order is paid — so keep that address current.
              </span>
            </span>
          </label>
        </fieldset>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-success">Saved!</span>}
        {formError && <span className="text-sm text-destructive">{formError}</span>}
      </div>
    </form>
  );
}
