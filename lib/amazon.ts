/**
 * Amazon affiliate helpers (server-only for the API bits).
 *
 * TODAY: we can build affiliate SEARCH links (with our associate tag) but CANNOT
 * fetch a product's title/price — that requires the Product Advertising API
 * (PA-API 5.0), which needs an approved Associates account (~3 qualifying sales
 * in 180 days). `getAmazonTopMatch` is wired to return that data the moment
 * PA-API keys are present; until then it returns null and callers fall back to a
 * quiet "available on Amazon" search link. See docs/amazon.md for the drop-in.
 */
export interface AmazonMatch {
  title: string;
  priceText?: string;
  imageUrl?: string;
  url: string;
}

function associateTag(): string | undefined {
  return process.env.AMAZON_ASSOCIATE_TAG || process.env.AMAZON_PARTNER_TAG || undefined;
}

/** Affiliate deep link to an Amazon search for `query`. */
export function amazonSearchUrl(query: string): string {
  const u = new URL("https://www.amazon.com/s");
  u.searchParams.set("k", query);
  const tag = associateTag();
  if (tag) u.searchParams.set("tag", tag);
  return u.toString();
}

export function isAmazonApiConfigured(): boolean {
  return !!(
    process.env.AMAZON_PAAPI_ACCESS_KEY &&
    process.env.AMAZON_PAAPI_SECRET_KEY &&
    process.env.AMAZON_PARTNER_TAG
  );
}

/**
 * Top Amazon product for a query — for the silent "also on Amazon" card on empty
 * search. Returns null until PA-API is configured (see file header). When you get
 * access, implement a PA-API 5.0 SearchItems call here (SearchIndex=All,
 * Resources: ItemInfo.Title, Offers.Listings.Price, Images.Primary.Medium) and
 * map the first result to AmazonMatch — every caller lights up automatically.
 */
export async function getAmazonTopMatch(query: string): Promise<AmazonMatch | null> {
  if (!isAmazonApiConfigured()) return null;
  try {
    // TODO(pa-api): signed SearchItems request → first item.
    // Intentionally not implemented until credentials exist (can't be tested).
    return null;
  } catch (err) {
    console.error("getAmazonTopMatch failed (non-fatal):", err);
    return null;
  }
}
