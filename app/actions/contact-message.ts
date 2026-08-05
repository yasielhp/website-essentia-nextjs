"use server";

import { contact } from "@/constants/contact";
import { contactMessageSchema } from "@/lib/schemas";
import { getAdminEmail, sendEmail } from "@/emails/send";
import { contactMessageEmail } from "@/emails/templates/contact-message";

/**
 * Delivers a contact form message to whoever runs the site.
 *
 * The form used to resolve a timer and claim success — nothing left the
 * browser. It now goes to the admin address on the `profiles` table, falling
 * back to the published inbox when no admin is on file, with the visitor's
 * address as `Reply-To` so answering the email answers them.
 */
export async function sendContactMessage(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = contactMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  const { firstName, lastName, email, interest, message } = parsed.data;
  const recipient = (await getAdminEmail()) ?? contact.email;

  const { error } = await sendEmail({
    to: recipient,
    replyTo: email,
    subject: `Contact form — ${firstName} ${lastName}`,
    html: contactMessageEmail({
      firstName,
      lastName,
      email,
      interest,
      message,
    }),
  });

  if (error) {
    console.error("[contact] delivery failed:", error.message);
    return { ok: false, error: "delivery" };
  }

  return { ok: true };
}
