import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { isPaidActivePlan } from "@/lib/membership";
import { EventForm } from "@/components/seller/EventForm";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Post an event" };

export default async function NewEventPage() {
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  const canPost = isPaidActivePlan(biz) || user?.role === "admin";

  if (!canPost) {
    return (
      <div className="max-w-xl rounded-xl border border-accent/40 bg-accent/10 p-6">
        <Lock className="size-6 text-accent" />
        <h1 className="mt-2 font-serif text-2xl font-semibold">Events need the annual plan</h1>
        <p className="mt-1 text-muted-foreground">
          Posting community events is included with the $150/year plan.
        </p>
        <Button asChild className="mt-4" variant="accent">
          <Link href="/seller/membership">Upgrade now</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">Post an event</h1>
      <EventForm />
    </div>
  );
}
