import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

// Fonts are self-hosted by next/font (no external CDN request) — good for CSP,
// performance, and privacy. Exposed as CSS variables consumed in globals.css.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "MainStreet — America's Hometown Marketplace & Community",
    template: "%s | MainStreet",
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    siteName: SITE.name,
    type: "website",
    locale: "en_US",
    url: SITE.url,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Site-wide structured data: the org (linked to the VA Corp network) + the site search box. */}
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <I18nProvider>
          <SessionProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
