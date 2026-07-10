import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/models/User";

/**
 * Augment Auth.js types so `session.user.id` and `session.user.role` are typed
 * everywhere. Roles drive route gating (proxy) and per-request authorization.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
