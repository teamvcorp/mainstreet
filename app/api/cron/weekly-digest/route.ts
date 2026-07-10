import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { sendWeeklyDigests } from "@/lib/digest";

/**
 * Weekly town digest. Triggered by Vercel Cron (Mondays) — Vercel passes
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set. Admins may also
 * trigger it manually. Long-running: allow up to 5 min.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const isCron = !!secret && auth === `Bearer ${secret}`;

  let isAdmin = false;
  if (!isCron) {
    const user = await getSessionUser().catch(() => null);
    isAdmin = user?.role === "admin";
  }
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendWeeklyDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("weekly-digest failed:", err);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
