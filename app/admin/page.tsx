import type { Metadata } from "next";
import Link from "next/link";
import { Store, CalendarDays, Truck, TrendingUp, Lightbulb, MapPin, Users, Mail } from "lucide-react";
import { getPlatformStats } from "@/lib/admin-stats";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

// Admin-only via proxy.ts.
export default async function AdminHome() {
  let stats = null;
  try {
    stats = await getPlatformStats();
  } catch (err) {
    console.error("admin stats failed:", err);
  }

  const kpis = stats
    ? [
        { label: "Revenue collected", value: formatCurrency(stats.revenueCents) },
        { label: "Shipping margin", value: formatCurrency(stats.marginCents), accent: true },
        { label: "Seller earnings (GMV)", value: formatCurrency(stats.gmvCents) },
        { label: "Paid orders", value: String(stats.orders) },
        { label: "Active members", value: String(stats.activeMembers) },
        { label: "Businesses", value: String(stats.businesses) },
        { label: "Towns", value: String(stats.towns) },
        { label: "Pending suggestions", value: String(stats.pendingSuggestions) },
      ]
    : [];

  const cards = [
    { href: "/admin/businesses", icon: Store, title: "Businesses", body: "Verify, suspend, delete." },
    { href: "/admin/orders", icon: Truck, title: "Fulfillment", body: "Tracking, labels, status." },
    { href: "/admin/events", icon: CalendarDays, title: "Events", body: "Approve flagged events." },
    { href: "/admin/gaps", icon: Lightbulb, title: "Demand gaps", body: "Unmet searches → leads." },
    { href: "/admin/suggestions", icon: TrendingUp, title: "Suggestions", body: "Nominated businesses." },
    { href: "/admin/towns", icon: MapPin, title: "Towns", body: "Hero, tagline, activate." },
    { href: "/admin/users", icon: Users, title: "Users", body: "Roles, password resets." },
    { href: "/admin/digest", icon: Mail, title: "Weekly digest", body: "Preview / send now." },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Admin</h1>
      <p className="mb-6 text-muted-foreground">Platform overview and moderation tools.</p>

      {kpis.length > 0 && (
        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className={`rounded-xl border p-4 ${k.accent ? "border-success/40 bg-success/5" : "border-border bg-card"}`}>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 font-serif text-xl font-semibold ${k.accent ? "text-success" : ""}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ href, icon: Icon, title, body }) => (
          <Link key={href} href={href} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Icon className="size-5" />
            </div>
            <h2 className="mt-3 font-serif text-base font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
