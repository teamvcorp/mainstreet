import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { VA_CORP, SISTER_PROGRAMS } from "@/lib/seo";
import { Wordmark } from "@/components/layout/Wordmark";
import { T } from "@/components/i18n/T";

/**
 * Site-wide footer.
 * - Addendum A Amazon fallback: the quietest link on the page (small, gray).
 * - VA Corp ecosystem backlinks: a dofollow link to the hub + a "Sister
 *   Programs" nav cross-linking the network (see SEO-BACKLINKS.md). Descriptive
 *   anchor text, absolute https URLs, no rel="nofollow" on network links.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-secondary/60">
      {/* Amazon store — a clear, tasteful CTA (stronger than the tiny link below,
          still framed as the "can't find it locally" fallback per Addendum A). */}
      <div className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center sm:px-6">
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
            href="/shop"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <T k="footer.amazonCta" /> <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Wordmark className="text-lg text-foreground" />
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            <T k="footer.tagline" />
          </p>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            <T k="footer.vacorpPrefix" />{" "}
            <Link href={VA_CORP.url} className="font-medium text-foreground underline underline-offset-2">
              VA Corp
            </Link>{" "}
            <T k="footer.vacorpSuffix" />
          </p>
        </div>

        <FooterCol
          titleKey="footer.explore"
          links={[
            { href: "/towns", labelKey: "footer.towns" },
            { href: "/events", labelKey: "footer.events" },
            { href: "/search", labelKey: "footer.search" },
          ]}
        />
        <FooterCol
          titleKey="footer.forBusiness"
          links={[
            { href: "/onboard/start", labelKey: "footer.sell" },
            { href: "/seller/membership", labelKey: "footer.membership" },
            { href: "/login", labelKey: "footer.signIn" },
          ]}
        />
        <FooterCol
          titleKey="footer.company"
          links={[
            { href: "/about", labelKey: "footer.about" },
            { href: "/contact", labelKey: "footer.contact" },
          ]}
        />
      </div>

      {/* Sister programs — reciprocal, descriptive, dofollow network links */}
      <div className="border-t border-border">
        <nav aria-label="VA Corp programs" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <T k="footer.sister" />
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
          <p>
            © {year} MainStreet — a VA Corp program. <T k="footer.rights" />
          </p>
          <Link
            href="/shop"
            className="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
          >
            <T k="footer.amazonShort" />
          </Link>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  titleKey,
  links,
}: {
  titleKey: string;
  links: { href: string; labelKey: string }[];
}) {
  return (
    <div>
      <h4 className="font-serif text-sm font-semibold text-foreground">
        <T k={titleKey} />
      </h4>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-muted-foreground hover:text-foreground">
              <T k={l.labelKey} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
