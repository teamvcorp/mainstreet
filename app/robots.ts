import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/**
 * Crawlers may index all public pages. Private/app surfaces (API, dashboards,
 * checkout, onboarding) are disallowed — they hold no SEO value and shouldn't
 * appear in search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/seller/", "/admin/", "/account/", "/checkout/", "/onboard/"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
