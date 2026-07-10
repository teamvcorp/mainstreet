import type { Metadata } from "next";
import { listUsersForAdmin } from "@/lib/admin-stats";
import { UserAdminList } from "@/components/admin/UserAdminList";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const users = await listUsersForAdmin();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Users</h1>
      <p className="mb-6 text-muted-foreground">Change roles or send a password-reset link.</p>
      <UserAdminList users={users} />
    </div>
  );
}
