import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  // proxy.ts already gates this route; re-check here as defense in depth.
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/account");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">My account</h1>
      <p className="mt-1 text-muted-foreground">Manage your profile and preferences.</p>

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-serif text-lg font-semibold">Profile</h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{user.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account type</dt>
              <dd className="font-medium capitalize">{user.role}</dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/orders">My orders</Link>
          </Button>
          {user.role === "consumer" && (
            <Button asChild variant="accent">
              <Link href="/onboard/start">Open a shop</Link>
            </Button>
          )}
          {(user.role === "seller" || user.role === "admin") && (
            <Button asChild>
              <Link href="/seller">Seller dashboard</Link>
            </Button>
          )}
        </section>
      </div>
    </div>
  );
}
