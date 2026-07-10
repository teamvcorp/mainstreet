import Link from "next/link";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Brand lockup: a barn-gold storefront tile + "MainStreet" (Street in accent).
 * Single component so the mark is identical in the header, footer, and emails.
 * Dropped the ".shop" suffix now that the canonical domain is mainstreet-shops.com.
 */
export function Wordmark({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="MainStreet home"
      className={cn("inline-flex items-center gap-2 font-serif text-xl font-semibold tracking-tight", className)}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-sm",
          iconClassName,
        )}
      >
        <Store className="size-5" aria-hidden />
      </span>
      <span>
        Main<span className="text-accent">Street</span>
      </span>
    </Link>
  );
}
