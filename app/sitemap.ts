import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { getAllActiveTownSlugs } from "@/lib/towns";
import { getActiveStorefrontSlugs } from "@/lib/storefront";

/**
 * Dynamic sitemap. Static marketing/discovery routes + a URL per active town.
 * Phase 3 will append active storefronts (/store/[slug]) and product pages here
 * once those routes exist — see docs/seo.md.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/towns`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/events`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

  let townRoutes: MetadataRoute.Sitemap = [];
  let storeRoutes: MetadataRoute.Sitemap = [];
  try {
    const [townSlugs, storeSlugs] = await Promise.all([
      getAllActiveTownSlugs(),
      getActiveStorefrontSlugs(),
    ]);
    townRoutes = townSlugs.map((slug) => ({
      url: `${SITE.url}/town/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
    storeRoutes = storeSlugs.map((slug) => ({
      url: `${SITE.url}/store/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));
  } catch (err) {
    // Don't fail sitemap generation if the DB is unavailable at build time.
    console.error("sitemap: could not load slugs —", err);
  }

  return [...staticRoutes, ...townRoutes, ...storeRoutes];
}
