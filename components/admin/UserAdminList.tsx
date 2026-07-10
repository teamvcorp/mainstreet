"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminUserRow } from "@/lib/admin-stats";

export function UserAdminList({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const filtered = users.filter((u) => !q || `${u.email} ${u.name ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  async function act(id: string, action: string) {
    setBusy(id);
    setNote(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (res.ok) {
      if (action === "send_reset") setNote("Password reset email sent.");
      else router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by email or name…" className="w-full bg-transparent text-sm focus:outline-none" />
      </div>
      {note && <p className="mb-3 text-sm text-success">{note}</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name ?? u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize">{u.role}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    {u.role !== "consumer" && (
                      <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => act(u.id, "set_consumer")}>Consumer</Button>
                    )}
                    {u.role !== "seller" && (
                      <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => act(u.id, "set_seller")}>Seller</Button>
                    )}
                    {u.role !== "admin" && (
                      <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => act(u.id, "set_admin")}>Make admin</Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => act(u.id, "send_reset")}>
                      <KeyRound className="size-4" /> Reset
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
