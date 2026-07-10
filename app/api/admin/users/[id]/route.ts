import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { PasswordResetToken } from "@/lib/models/PasswordResetToken";
import { sendEmail } from "@/lib/resend";
import { errorResponse } from "@/lib/api";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const bodySchema = z.object({
  action: z.enum(["set_consumer", "set_seller", "set_admin", "send_reset"]),
});

/** Admin user management: change role, or send a password-reset link. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  try {
    await requireRole(["admin"]);
    const { id } = await ctx.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    await connectToDatabase();
    const user = await User.findById(id).select("email role");
    if (!user) throw new Error("NOT_FOUND");

    if (parsed.data.action === "send_reset") {
      const raw = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(raw).digest("hex");
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await sendEmail({
        to: user.email,
        subject: "Reset your MainStreet password",
        text: `An administrator started a password reset for your account.\n\nReset it here (expires in 1 hour):\n${APP_URL}/reset-password?token=${raw}\n\nIf you didn't expect this, you can ignore it.`,
      });
      return NextResponse.json({ ok: true, sent: true });
    }

    const role =
      parsed.data.action === "set_admin" ? "admin" : parsed.data.action === "set_seller" ? "seller" : "consumer";
    await User.updateOne({ _id: id }, { $set: { role } });
    return NextResponse.json({ ok: true, role });
  } catch (err) {
    return errorResponse(err);
  }
}
