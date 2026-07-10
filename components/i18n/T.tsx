"use client";

import { useT } from "@/components/i18n/I18nProvider";

/**
 * Render a translated UI string by key. Usable inside server components (it's a
 * client child) so pages/chrome stay server-rendered while text localizes.
 * Example: <T k="nav.towns" />
 */
export function T({ k }: { k: string }) {
  return <>{useT()(k)}</>;
}
