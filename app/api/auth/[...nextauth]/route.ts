import { handlers } from "@/auth";

// Auth.js mounts all its endpoints (signin, callback, session, csrf, signout…)
// under this catch-all route.
export const { GET, POST } = handlers;
