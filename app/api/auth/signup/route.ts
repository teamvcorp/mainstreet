import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { signupSchema } from "@/schemas/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Throttle account creation per IP.
  const ip = await getClientIp();
  const rl = await rateLimit({ key: "auth-signup", limit: 5, windowSeconds: 60, identifier: ip });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;
  await connectToDatabase();

  const existing = await User.findOne({ email }).select("_id");
  if (existing) {
    // Don't reveal much, but 409 is standard for "already registered".
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email, passwordHash, role: "consumer" });

  // Client will call signIn('credentials') next. We don't return the user.
  return NextResponse.json({ ok: true }, { status: 201 });
}
