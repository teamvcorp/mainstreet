"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Package, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Status {
  tier: string;
  paidActive: boolean;
  membershipExpiresAt: string | null;
  itemLimit: number;
  extraItemBlocks: number;
  productCount: number;
  stripeConfigured: boolean;
}

export default function MembershipPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Backstop: reconcile plan from Stripe before reading status, so a paid
      // membership shows immediately even if the webhook hasn't landed.
      await fetch("/api/memberships/sync", { method: "POST" }).catch(() => {});
      try {
        const r = await fetch("/api/memberships/status");
        setStatus(await r.json());
      } catch {
        setStatus(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function go(path: string, body?: unknown) {
    setBusy(path);
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (data.url) window.location.href = data.url;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading membership…
      </div>
    );
  }

  if (status && !status.stripeConfigured) {
    return (
      <div className="max-w-xl rounded-xl border border-border bg-card p-6">
        <h1 className="font-serif text-2xl font-semibold">Membership</h1>
        <p className="mt-2 text-muted-foreground">Billing isn&apos;t configured in this environment yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold">Membership</h1>
        <p className="text-muted-foreground">Your plan, renewal, and catalog capacity.</p>
      </header>

      {/* Current plan */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <BadgeCheck className={status?.paidActive ? "size-5 text-success" : "size-5 text-muted-foreground"} />
          <h2 className="font-serif text-lg font-semibold capitalize">{status?.tier} plan</h2>
        </div>
        {status?.paidActive ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Active{status.membershipExpiresAt ? ` · renews ${new Date(status.membershipExpiresAt).toLocaleDateString()}` : ""}.
            Full storefront, shipping, and community events unlocked.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re on the free listed plan. Upgrade to sell online, ship, and post events.
            </p>
            <Button className="mt-4" disabled={busy !== null} onClick={() => go("/api/memberships/subscribe")}>
              {busy === "/api/memberships/subscribe" ? <Loader2 className="size-4 animate-spin" /> : null}
              Upgrade — $150/year
            </Button>
          </>
        )}
      </div>

      {/* Item capacity */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-accent" />
          <h2 className="font-serif text-lg font-semibold">Catalog capacity</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Using <span className="font-medium text-foreground">{status?.productCount}</span> of{" "}
          <span className="font-medium text-foreground">{status?.itemLimit}</span> items
          {status && status.extraItemBlocks > 0 ? ` (${status.extraItemBlocks} pack${status.extraItemBlocks > 1 ? "s" : ""} added)` : ""}.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Each pack adds 50 items for $5/month.</p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => go("/api/memberships/add-items", { blocks: 1 })}>
            {busy === "/api/memberships/add-items" ? <Loader2 className="size-4 animate-spin" /> : null}
            Add 50 items (+$5/mo)
          </Button>
        </div>
      </div>

      {/* Manage billing */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your card, view invoices, or cancel anytime.
        </p>
        <Button variant="ghost" className="mt-3" disabled={busy !== null} onClick={() => go("/api/memberships/portal")}>
          Manage billing <ExternalLink className="size-4" />
        </Button>
      </div>
    </div>
  );
}
