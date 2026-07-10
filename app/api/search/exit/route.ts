import { NextResponse } from "next/server";
import { z } from "zod";
import { logSearchExit } from "@/lib/search";

const bodySchema = z.object({
  query: z.string().max(200).default(""),
  townSlug: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  type: z.enum(["amazon", "suggest", "adjacent_town", "bounced"]),
});

/** Log a specific exit action (Amazon click, adjacent-town click, etc.). */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }
  await logSearchExit({
    query: parsed.data.query,
    townSlug: parsed.data.townSlug,
    category: parsed.data.category,
    exitType: parsed.data.type,
  });
  return NextResponse.json({ ok: true });
}
