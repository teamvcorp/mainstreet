import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { PasswordResetToken } from "@/lib/models/PasswordResetToken";
import { resetSchema } from "@/schemas/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = await getClientIp();
  const rl = await rateLimit({ key: "auth-reset", limit: 10, windowSeconds: 300, identifier: ip });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { token, password } = parsed.data;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await connectToDatabase();
  const record = await PasswordResetToken.findOne({
    tokenHash,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });
  if (!record) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.updateOne({ _id: record.userId }, { $set: { passwordHash } });
  record.usedAt = new Date();
  await record.save();

  // Invalidate any other outstanding tokens for this user.
  await PasswordResetToken.updateMany(
    { userId: record.userId, usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
  );

  return NextResponse.json({ ok: true });
}
