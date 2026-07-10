import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Pencil, Clock, CheckCircle2, Lock } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { getBusinessEvents } from "@/lib/events";
import { isPaidActivePlan } from "@/lib/membership";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My events" };

export default async function SellerEventsPage() {
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  const canPost = isPaidActivePlan(biz) || user?.role === "admin";
  const events = await getBusinessEvents(biz._id.toString());

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">My events</h1>
          <p className="text-muted-foreground">Post community events for {biz.name}.</p>
        </div>
        {canPost && (
          <Button asChild>
            <Link href="/seller/events/new">
              <Plus className="size-4" /> Post an event
            </Link>
          </Button>
        )}
      </div>

      {!canPost && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <Lock className="mt-0.5 size-5 text-accent" />
          <div>
            <p className="font-medium">Events are part of the annual plan</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to the $150/year plan to post community events and reach your whole town.
            </p>
            <Button asChild size="sm" variant="accent" className="mt-3">
              <Link href="/seller/membership">View membership</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No events yet.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {events.map((e) => {
              const when = e.startAt
                ? new Date(e.startAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "";
              return (
                <li key={e._id.toString()} className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">{when}</p>
                  </div>
                  {e.isApproved ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3.5" /> Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent-foreground">
                      <Clock className="size-3.5" /> Pending review
                    </span>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/seller/events/${e._id.toString()}`}>
                      <Pencil className="size-4" /> Edit
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
