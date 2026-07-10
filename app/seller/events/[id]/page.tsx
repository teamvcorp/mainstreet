import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Event } from "@/lib/models/Event";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { EventEditForm } from "@/components/seller/EventEditForm";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  await connectToDatabase();
  const ev = await Event.findOne({ _id: id, businessId: biz._id }).lean<{
    _id: { toString(): string };
    title: string;
    description?: string;
  }>();
  if (!ev) notFound();

  return (
    <div>
      <h1 className="mb-2 font-serif text-3xl font-semibold">Edit event</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        You can update the event name and details. Date, time, and contact info stay as set.
      </p>
      <EventEditForm
        eventId={ev._id.toString()}
        initialTitle={ev.title}
        initialDescription={ev.description}
      />
    </div>
  );
}
