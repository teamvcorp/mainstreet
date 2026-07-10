import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/models/User";

/**
 * Edge/proxy-safe Auth.js config. Deliberately contains NO database access,
 * bcrypt, or provider secrets logic — only what the proxy needs to gate routes
 * by reading the already-issued JWT. The heavy bits (Credentials.authorize,
 * user upsert) live in auth.ts, which the API route handler uses.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [], // real providers are added in auth.ts
  callbacks: {
    /**
     * Route protection. Returning false redirects unauthenticated/unauthorized
     * users to the sign-in page. Mirrors proxy.ts matcher.
     */
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user;
      const isLoggedIn = !!user;
      const path = nextUrl.pathname;

      if (path.startsWith("/admin")) {
        return isLoggedIn && user.role === "admin";
      }
      if (path.startsWith("/seller")) {
        return isLoggedIn && (user.role === "seller" || user.role === "admin");
      }
      if (path.startsWith("/account") || path.startsWith("/checkout")) {
        return isLoggedIn;
      }
      return true;
    },
    /** Copy id/role from the token into the session exposed to the app. */
    session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      if (typeof token.role === "string") {
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
