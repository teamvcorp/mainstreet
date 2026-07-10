import { Resend } from "resend";

/**
 * Thin email wrapper. If RESEND_API_KEY is missing (local dev), we log the email
 * to the console instead of sending — so flows that email (password reset, order
 * confirmations, ship handoff) work end-to-end without a Resend account.
 */
let client: Resend | null | undefined;
function getClient(): Resend | null {
  if (client !== undefined) return client;
  const key = process.env.RESEND_API_KEY;
  client = key ? new Resend(key) : null;
  return client;
}

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(args: SendEmailArgs) {
  const from = process.env.EMAIL_FROM ?? "MainStreet <onboarding@resend.dev>";
  const c = getClient();

  if (!c) {
    console.log(
      `\n[email:dev] (RESEND_API_KEY not set — not actually sent)\n  to: ${args.to}\n  subject: ${args.subject}\n  body:\n${args.text ?? args.html ?? ""}\n`,
    );
    return { id: "dev-skipped" };
  }

  const { data, error } = await c.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html ?? `<pre>${args.text ?? ""}</pre>`,
    text: args.text,
    replyTo: args.replyTo,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}
