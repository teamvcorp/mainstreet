import { NextResponse } from "next/server";
import { searchAll } from "@/lib/search";

/**
 * Unified platform-only search. Queries ONLY our own collections — never any
 * external source. (See lib/search.ts.)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 120);
  try {
    const results = await searchAll(q, {
      townSlug: searchParams.get("town") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      category: searchParams.get("category") ?? undefined,
    });
    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/search/all failed:", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
