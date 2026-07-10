"use client";

import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccountStatus {
  connected: boolean;
  active: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  configured: boolean;
}

export default function ConnectPage() {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connect/account")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold">Payouts</h1>
        <p className="text-muted-foreground">
          MainStreet uses Stripe to pay you directly. We never see your bank details.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking your account…
        </div>
      ) : status?.configured === false ? (
        <Notice
          icon={<AlertCircle className="size-5 text-accent" />}
          title="Payments aren't configured yet"
          body="Stripe keys haven't been added to this environment. Once they are, you'll be able to connect your account here."
        />
      ) : status?.active ? (
        <Notice
          icon={<CheckCircle2 className="size-5 text-success" />}
          title="You're all set to get paid"
          body="Your Stripe account is active. Charges and payouts are enabled."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <CreditCard className="size-5" />
          </div>
          <h2 className="mt-3 font-serif text-lg font-semibold">
            {status?.connected ? "Finish connecting your account" : "Connect your account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ll be taken to Stripe to enter your bank and identity details securely.
          </p>
          <Button asChild className="mt-4">
            {/* GET route creates/refreshes the account link, then redirects to Stripe. */}
            <a href="/api/connect/onboard">
              {status?.connected ? "Continue setup" : "Connect with Stripe"}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function Notice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
