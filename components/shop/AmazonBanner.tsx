import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/components/i18n/T";

/**
 * Prominent "Can't find it locally?" Amazon CTA. Shown only where a search returned
 * no local results (NOT site-wide) and always carries the search term to /shop, so the
 * shopper never re-types what they were looking for.
 */
export function AmazonBanner({ query, className }: { query?: string; className?: string }) {
  const href = query ? `/shop?q=${encodeURIComponent(query)}` : "/shop";
  return (
    <div className={cn("rounded-xl bg-primary text-primary-foreground", className)}>
      <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ShoppingBag className="size-5" />
          </span>
          <div>
            <p className="font-serif text-lg font-semibold">
              <T k="footer.amazonTitle" />
            </p>
            <p className="text-sm text-primary-foreground/80">
              <T k="footer.amazonBody" />
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
        >
          <T k="footer.amazonCta" /> <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
