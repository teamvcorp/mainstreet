import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { uploadLabel } from "@/lib/blob";
import { errorResponse } from "@/lib/api";

/** Admin-only label upload (PDF or image) → Vercel Blob. */
export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const url = await uploadLabel(file, "labels");
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
