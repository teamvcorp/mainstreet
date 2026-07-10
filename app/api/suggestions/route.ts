import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { BusinessSuggestion } from "@/lib/models/BusinessSuggestion";
import { Town } from "@/lib/models/Town";
import { createSuggestionSchema } from "@/schemas/suggestion";
import { logSearchExit } from "@/lib/search";
import { sendEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api";

/**
 * "Suggest a business" — no auth (lower friction = more leads). Creates a
 * suggestion, logs the exit for /admin/gaps, and emails the admin.
 */
export async function POST(request: Request) {
  try {
    const rl = await rateLimit({
      key: "suggestion",
      limit: 8,
      windowSeconds: 300,
      identifier: await getClientIp(),
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    }

    const parsed = createSuggestionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const data = parsed.data;

    await connectToDatabase();
    let townId = data.townId;
    if (!townId && data.townSlug) {
      const t = await Town.findOne({ slug: data.townSlug.toLowerCase() }).select("_id");
      townId = t?._id?.toString();
    }

    await BusinessSuggestion.create({
      businessName: data.businessName,
      townId,
      category: data.category,
      address: data.address,
      phone: data.phone,
      website: data.website || undefined,
      notes: data.notes,
      searchQuery: data.searchQuery,
      status: "pending",
    });

    await logSearchExit({
      query: data.searchQuery ?? data.businessName,
      townSlug: data.townSlug,
      category: data.category,
      exitType: "suggest",
    });

    // Best-effort admin notification (no-op if email isn't configured).
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `New business suggestion: ${data.businessName}`,
        text: [
          `Business: ${data.businessName}`,
          data.category ? `Category: ${data.category}` : "",
          data.address ? `Address: ${data.address}` : "",
          data.phone ? `Phone: ${data.phone}` : "",
          data.website ? `Website: ${data.website}` : "",
          data.searchQuery ? `Searched for: ${data.searchQuery}` : "",
          data.notes ? `Notes: ${data.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
