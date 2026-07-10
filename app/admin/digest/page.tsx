"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Manual trigger for the weekly town digest (also runs automatically via cron). */
export default function AdminDigestPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ towns: number; emails: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/cron/weekly-digest");
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setResult({ towns: data.towns ?? 0, emails: data.emails ?? 0 });
    else setError(data.error ?? "Failed to send digest.");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Weekly digest</h1>
      <p className="mb-6 text-muted-foreground">
        Runs automatically every Monday. You can also send it now — it emails each town&apos;s
        followers a roundup of this week&apos;s events, shops, and new arrivals.
      </p>
      <Button onClick={run} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Send digest now
      </Button>
      {result && (
        <p className="mt-4 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> Sent to {result.emails} recipient(s) across {result.towns} town(s).
        </p>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
