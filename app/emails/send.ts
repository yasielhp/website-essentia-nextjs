"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  // Public server action — intentionally no auth check (used for unauthenticated booking confirmations and internal admin flows)
  const from =
    process.env.RESEND_FROM_EMAIL ?? "Essentia <noreply@essentia.com>";

  const { error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    console.error("[sendEmail] Failed to send to", to, ":", error.message);
  }

  return { error };
}
