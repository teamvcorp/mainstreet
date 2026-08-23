import type { ReactNode } from "react";

/**
 * The admin area is a live control panel — it must never be served from Next.js's
 * static/full-route cache. Access is gated by `proxy.ts` (middleware), so the pages
 * themselves don't read cookies and would otherwise be statically prerendered at
 * build time (a frozen DB snapshot). Forcing the whole /admin subtree dynamic makes
 * every page re-query MongoDB per request, so admin actions — add a town, edit a
 * tagline, verify a business — reflect immediately instead of after a redeploy.
 */
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
