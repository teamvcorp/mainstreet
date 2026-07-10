"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

const linkCls = "rounded-md px-3 py-2 text-sm hover:bg-primary-foreground/10";

/**
 * Auth-aware header island. Uses useSession (client) so the surrounding page
 * can stay static. Shows Sign in when logged out; account/role links otherwise.
 */
export function AccountMenu() {
  const { data: session, status } = useSession();

  if (status !== "authenticated") {
    return (
      <Link href="/login" className={linkCls}>
        Sign in
      </Link>
    );
  }

  const role = session.user.role;
  return (
    <div className="flex items-center gap-0.5">
      {role === "admin" && (
        <Link href="/admin" className={linkCls}>
          Admin
        </Link>
      )}
      {(role === "seller" || role === "admin") && (
        <Link href="/seller" className={linkCls}>
          Dashboard
        </Link>
      )}
      <Link href="/account" className={linkCls}>
        Account
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className={linkCls}
      >
        Sign out
      </button>
    </div>
  );
}
