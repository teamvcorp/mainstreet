"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { LOCALES } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

/** EN / ES toggle for the header. Persists via cookie; swaps UI copy instantly. */
export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div
      className="flex items-center overflow-hidden rounded-md text-xs ring-1 ring-inset ring-primary-foreground/25"
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cn(
            "px-2 py-1 font-medium transition-colors",
            locale === l
              ? "bg-accent text-accent-foreground"
              : "text-primary-foreground/80 hover:bg-primary-foreground/10",
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
