import type { ReactElement } from "react";
import { Resend } from "resend";

/**
 * Transactional email helper (Resend). Accepts a React Email element (`react`)
 * which Resend renders to HTML, or raw html/text. No-op when RESEND_API_KEY is
 * unset so the app works in dev.
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
  react?: ReactElement;
  html?: string;
  text?: string;
}): Promise<{ sent: boolean }> {
  const resend = getClient();
  if (!resend) return { sent: false };
  // Must be on a Resend-verified domain (fyht4.com). Display name is fine.
  const from = process.env.EMAIL_FROM ?? "MainStreet <hello@fyht4.com>";
  try {
    if (input.react) {
      await resend.emails.send({ from, to: input.to, subject: input.subject, react: input.react });
    } else {
      await resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html ?? input.text ?? "",
        text: input.text,
      });
    }
    return { sent: true };
  } catch (err) {
    console.error("sendEmail failed (non-fatal):", err);
    return { sent: false };
  }
}
