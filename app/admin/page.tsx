import type { Metadata } from "next";
import Link from "next/link";
import { Store, CalendarDays } from "lucide-react";

export const metadata: Metadata = { title: "Admin" };

// Admin-only via proxy.ts. Full dashboard (revenue, shipping margins, gaps,
// towns, users) arrives in Phase 9 — these are the moderation tools live today.
export default function AdminHome() {
  const cards = [
    { href: "/admin/businesses", icon: Store, title: "Businesses", body: "Verify, suspend, or delete listings. Towns auto-group by address." },
    { href: "/admin/events", icon: CalendarDays, title: "Event moderation", body: "Approve or reject events flagged for review." },
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Admin</h1>
      <p className="mb-6 text-muted-foreground">Moderation tools.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, icon: Icon, title, body }) => (
          <Link key={href} href={href} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Icon className="size-5" />
            </div>
            <h2 className="mt-3 font-serif text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
