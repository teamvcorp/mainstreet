"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/I18nProvider";

/** Layer 1 of the empty-results exit: turn a miss into a recruitment lead. */
export function SuggestBusinessForm({
  searchQuery,
  townSlug,
}: {
  searchQuery?: string;
  townSlug?: string;
}) {
  const t = useT();
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState(searchQuery ?? "");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, category: category || undefined, notes: notes || undefined, searchQuery, townSlug }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not submit. Please try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
        <CheckCircle2 className="size-5 text-success" />
        {t("search.thanks")}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bn">{t("search.bnName")}</Label>
          <Input id="bn" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required minLength={2} />
        </div>
        <div>
          <Label htmlFor="bc">{t("search.bnSells")}</Label>
          <Input id="bc" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="bnotes">{t("search.bnNotes")}</Label>
        <Textarea id="bnotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? t("search.submitting") : t("search.suggestBtn")}
      </Button>
    </form>
  );
}
