"use client";

import { useT } from "@/components/i18n/I18nProvider";

/**
 * A search <input> whose placeholder/aria-label localize (attributes need a
 * string, so this must be a client component). The enclosing <form> can stay
 * server-rendered.
 */
export function LocalizedSearchInput({
  placeholderKey,
  className,
  autoFocus,
}: {
  placeholderKey: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const t = useT();
  const label = t(placeholderKey);
  return (
    <input
      type="search"
      name="q"
      placeholder={label}
      aria-label={label}
      autoFocus={autoFocus}
      className={className}
    />
  );
}
