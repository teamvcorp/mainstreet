import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { StoreProfileForm } from "@/components/seller/StoreProfileForm";

export const metadata: Metadata = { title: "Store profile" };

export default async function StoreProfilePage() {
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl font-semibold">Store profile</h1>
      <p className="mb-6 text-muted-foreground">How your shop appears to customers.</p>
      <StoreProfileForm
        initial={{
          id: biz._id.toString(),
          name: biz.name,
          category: biz.category,
          description: biz.description,
          story: biz.story,
          phone: biz.phone,
          email: biz.email,
          website: biz.website,
          address: biz.address,
          logoUrl: biz.logoUrl,
          bannerUrl: biz.bannerUrl,
          shipsOnline: biz.shipsOnline,
          acceptsLocalPickup: biz.acceptsLocalPickup,
        }}
      />
    </div>
  );
}
