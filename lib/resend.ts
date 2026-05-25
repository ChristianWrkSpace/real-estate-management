import { Resend } from "resend";

let _client: Resend | null = null;

export function getResend() {
  if (!_client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not set in .env.local");
    }
    _client = new Resend(process.env.RESEND_API_KEY);
  }
  return _client;
}

export function getFromAddress() {
  return process.env.RESEND_FROM ?? "onboarding@resend.dev";
}

interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject,
    html,
    replyTo,
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  return data;
}
