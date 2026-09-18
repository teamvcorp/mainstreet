import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { errorResponse } from "@/lib/api";
import { runProspectPass } from "@/lib/prospects/ingest";

/**
 * Prospect ingest pass. Triggered by Vercel Cron, or manually by an admin from
 * /admin/prospects (the same contract the weekly digest uses).
 *
 * Long-running by nature: one pass streams ~205 MB from the State of Iowa at roughly
 * 1.76 MiB/s, so budget ~120 s. `runProspectPass` enforces its own soft deadline
 * (PROSPECTS_INGEST_MAX_MS, default 240 s) and returns `partial` rather than being SIGKILLed,
 * because a clean partial with an accurate ledger is far better than a killed function that
 * leaves the run lock held.
 *
 * A pass with no pending areas returns `noop` in milliseconds without touching the network,
 * which is why a daily cron costs nothing.
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

  // ?dry=1 streams and counts the whole source without writing a single prospect row. This is
  // the safe way to verify the ZIP framing, the prefilter and the area matching against live
  // data - and to answer "how many businesses would this area actually give me?" before
  // committing anything to the database.
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  try {
    const result = await runProspectPass({ trigger: isCron ? "cron" : "admin", dryRun });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (err) {
    // Unlike the other cron routes, this one goes through errorResponse: the admin UI needs to
    // distinguish INGEST_RUNNING (409, "someone else is already pulling") from a real failure.
    console.error("prospect-ingest failed:", err);
    return errorResponse(err);
  }
}
