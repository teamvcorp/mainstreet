import { auth } from "@/auth";
import type { UserRole } from "@/lib/models/User";

export interface SessionUser {
  id: string;
  role: UserRole;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

/** Current signed-in user (or null). Safe to call in server components/routes. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}

/** Throwing guard for API routes. Callers map the thrown code to an HTTP status. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
