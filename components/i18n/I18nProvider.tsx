"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import en from "@/lib/i18n/en";
import { DICTIONARIES, resolvePath } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";

/**
 * Client-side locale. English is the SSR/SSG baseline (so town/store pages stay
 * statically generated and English-indexed for SEO). On mount we read the
 * NEXT_LOCALE cookie and re-render in the chosen language — UI copy only; no
 * user/business data is ever translated.
 */
interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
  return isLocale(m?.[1]) ? (m![1] as Locale) : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // After hydration, adopt the persisted locale (avoids SSR/client mismatch).
  useEffect(() => {
    const cookieLocale = readCookieLocale();
    if (cookieLocale !== locale) setLocaleState(cookieLocale);
    document.documentElement.lang = cookieLocale;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: string) => resolvePath(DICTIONARIES[locale], key) ?? resolvePath(en, key) ?? key,
    [locale],
  );

  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
export function useLocale() {
  return useI18n().locale;
}
