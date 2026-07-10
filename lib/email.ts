import { Resend } from "resend";

/**
 * Minimal transactional email helper (Resend). Returns a no-op when
 * RESEND_API_KEY is unset so the app works in dev. Phase 8 builds the React
 * Email templates on top of this — every send funnels through here.
 */
let client: Resend | null | undefined;

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function getClient(): Resend | null {
  if (client !== undefined) return client;
  const key = process.env.RESEND_API_KEY;
  client = key ? new Resend(key) : null;
  return client;
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ sent: boolean }> {
  const resend = getClient();
  if (!resend) return { sent: false };
  const from = process.env.EMAIL_FROM ?? "hello@mainstreet-shops.com";
  try {
    await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html ?? input.text ?? "",
      text: input.text,
    });
    return { sent: true };
  } catch (err) {
    console.error("sendEmail failed (non-fatal):", err);
    return { sent: false };
  }
}
