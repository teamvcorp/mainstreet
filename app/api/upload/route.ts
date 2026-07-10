import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { uploadImage } from "@/lib/blob";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api";

/** Authenticated image upload to Vercel Blob. MIME + size validated server-side. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const rl = await rateLimit({ key: "upload", limit: 40, windowSeconds: 60, identifier: user.id });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many uploads. Slow down a moment." }, { status: 429 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const url = await uploadImage(file, `u/${user.id}`);
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
