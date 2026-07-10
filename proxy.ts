// Next.js 16 renamed `middleware` → `proxy` (Node runtime). We re-export the
// Auth.js `auth` handler (aliased to `proxy`) from a sibling module — a
// re-exported named binding is what Next's static check recognizes as the
// proxy function. Route gating happens in auth.config.ts's `authorized` callback.
export { proxy } from "@/lib/auth-proxy";

export const config = {
  // Gate seller/admin/account/checkout. Cart is intentionally guest-friendly.
  matcher: [
    "/seller/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/checkout/:path*",
    "/orders/:path*",
  ],
};
