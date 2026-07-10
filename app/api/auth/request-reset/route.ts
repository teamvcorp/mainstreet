import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { PasswordResetToken } from "@/lib/models/PasswordResetToken";
import { requestResetSchema } from "@/schemas/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: Request) {
  const ip = await getClientIp();
  const rl = await rateLimit({ key: "auth-reset-req", limit: 5, windowSeconds: 300, identifier: ip });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestResetSchema.safeParse(body);
  // Always respond 200 regardless — never disclose whether an email is registered.
  if (!parsed.success) return NextResponse.json({ ok: true });

  await connectToDatabase();
  const user = await User.findOne({ email: parsed.data.email }).select("_id email");

  if (user) {
    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    const link = `${APP_URL}/reset-password?token=${raw}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your MainStreet password",
      text: `We received a request to reset your password.\n\nReset it here (expires in 1 hour):\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    });
  }

  return NextResponse.json({ ok: true });
}
