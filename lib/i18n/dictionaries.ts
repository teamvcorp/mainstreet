import en from "./en";
import es from "./es";
import type { Locale } from "./locales";

export const DICTIONARIES = { en, es } as const;

/** Resolve a dot-path (e.g. "footer.amazonTitle") to a string, or undefined. */
export function resolvePath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

export function getDictionary(locale: Locale) {
  return DICTIONARIES[locale] ?? en;
}
