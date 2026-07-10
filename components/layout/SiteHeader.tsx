import Link from "next/link";
import { Store, Search, MapPin, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/layout/AccountMenu";

/**
 * Site-wide header. Server component — the search form is a plain GET form
 * (no client JS needed) that submits to the platform-only /search page.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold">
          <Store className="size-6 text-accent" aria-hidden />
          <span>
            MainStreet<span className="text-accent">.shop</span>
          </span>
        </Link>

        {/* Platform-only search */}
        <form action="/search" method="get" className="order-last w-full sm:order-0 sm:w-auto sm:flex-1 sm:max-w-md">
          <div className="flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2 ring-1 ring-inset ring-primary-foreground/15 focus-within:ring-accent">
            <Search className="size-4 opacity-70" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Search local businesses, products, events…"
              aria-label="Search MainStreet"
              className="w-full bg-transparent text-sm placeholder:text-primary-foreground/60 focus:outline-none"
            />
          </div>
        </form>

        {/* Nav */}
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/towns"
            className="hidden items-center gap-1.5 rounded-md px-3 py-2 hover:bg-primary-foreground/10 md:flex"
          >
            <MapPin className="size-4 text-accent" aria-hidden /> Towns
          </Link>
          <Link
            href="/events"
            className="hidden items-center gap-1.5 rounded-md px-3 py-2 hover:bg-primary-foreground/10 md:flex"
          >
            <CalendarDays className="size-4 text-accent" aria-hidden /> Events
          </Link>
          <Button asChild variant="accent" size="sm">
            <Link href="/onboard/start">Sell</Link>
          </Button>
          <AccountMenu />
        </nav>
      </div>
    </header>
  );
}
