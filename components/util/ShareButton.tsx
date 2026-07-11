"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * Share the current page via the native share sheet (mobile) with a
 * clipboard-copy fallback (desktop).
 */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onShare}>
      {copied ? <Check className="size-4 text-success" /> : <Share2 className="size-4" />}
      {copied ? t("common.linkCopied") : t("common.share")}
    </Button>
  );
}
