import Link from "next/link";
import { VA_CORP, SISTER_PROGRAMS } from "@/lib/seo";
import { Wordmark } from "@/components/layout/Wordmark";

/**
 * Site-wide footer.
 * - Addendum A Amazon fallback: the quietest link on the page (small, gray).
 * - VA Corp ecosystem backlinks: a dofollow link to the hub + a "Sister
 *   Programs" nav cross-linking the network (see SEO-BACKLINKS.md). Descriptive
 *   anchor text, absolute https URLs, no rel="nofollow" on network links.
 */
export function SiteFooter() {
  const amazonUrl = process.env.NEXT_PUBLIC_AMAZON_STOREFRONT_URL;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-secondary/60">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Wordmark className="text-lg text-foreground" />
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            America&apos;s hometown digital platform. Shop local, support your neighbors.
          </p>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A{" "}
            <Link href={VA_CORP.url} className="font-medium text-foreground underline underline-offset-2">
              VA Corp
            </Link>{" "}
            program — advancing equality &amp; sustainability in housing, education, and healthcare.
          </p>
        </div>

        <FooterCol
          title="Explore"
          links={[
            { href: "/towns", label: "Towns" },
            { href: "/events", label: "Events" },
            { href: "/search", label: "Search" },
          ]}
        />
        <FooterCol
          title="For Business"
          links={[
            { href: "/onboard/start", label: "Sell on MainStreet" },
            { href: "/seller/membership", label: "Membership" },
            { href: "/login", label: "Sign in" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { href: "/about", label: "About" },
            { href: "/contact", label: "Contact" },
          ]}
        />
      </div>

      {/* Sister programs — reciprocal, descriptive, dofollow network links */}
      <div className="border-t border-border">
        <nav aria-label="VA Corp programs" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sister programs in the VA Corp family
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {SISTER_PROGRAMS.map((p) => (
              <li key={p.url}>
                <a href={p.url} className="text-muted-foreground hover:text-foreground">
                  {p.name} — {p.focus}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {year} MainStreet — a VA Corp program. All rights reserved.</p>
          {amazonUrl ? (
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              Can&apos;t find it locally? Our Amazon store →
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="font-serif text-sm font-semibold text-foreground">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
