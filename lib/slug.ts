import { slugify } from "@/lib/utils";

/**
 * Produce a slug from `base` that passes the async `taken` check, appending
 * -2, -3, … on collision (and a timestamp as a last resort).
 */
export async function uniqueSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "shop";
  if (!(await taken(root))) return root;
  for (let i = 2; i < 50; i++) {
    const candidate = `${root}-${i}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
