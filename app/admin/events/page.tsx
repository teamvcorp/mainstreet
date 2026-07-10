import type { Metadata } from "next";
import { EventApprovalList } from "@/components/admin/EventApprovalList";

export const metadata: Metadata = { title: "Event moderation" };

// Access is enforced by proxy.ts (admin only). Full admin panel arrives in Phase 9.
export default function AdminEventsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Event moderation</h1>
      <p className="mb-6 text-muted-foreground">
        Events flagged as duplicates, scheduled at the same time as another, or caught by the
        language check land here for approval.
      </p>
      <EventApprovalList />
    </div>
  );
}
