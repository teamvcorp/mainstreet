import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { OnboardStartForm } from "@/components/seller/OnboardStartForm";

export const metadata: Metadata = { title: "Open your shop" };

export default async function OnboardStartPage() {
  const user = await getSessionUser();
  if (!user) redirect(`/signup?callbackUrl=${encodeURIComponent("/onboard/start")}`);

  // Already have a shop? Skip straight to the dashboard.
  const existing = await getMyBusiness(user.id);
  if (existing) redirect("/seller");

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium text-accent-foreground">Step 1 of 3</p>
        <h1 className="mt-1 font-serif text-4xl font-semibold">Open your shop on MainStreet</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us the basics and where you&apos;re located — we&apos;ll set up your hometown page
          automatically. Next you&apos;ll add your story and set up payouts.
        </p>
      </header>

      <OnboardStartForm />
    </div>
  );
}
