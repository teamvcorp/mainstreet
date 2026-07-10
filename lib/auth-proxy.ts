import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Instantiate the light (DB-free) Auth.js handler used purely for route gating.
// Kept in its own module so proxy.ts can RE-EXPORT the `proxy` binding — Next 16
// only recognizes a re-exported named function, not a destructured const.
export const { auth: proxy } = NextAuth(authConfig);
