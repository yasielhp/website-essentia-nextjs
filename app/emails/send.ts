import { Resend } from "resend";
import { getAdminClient } from "@/lib/insforge-admin";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  /** Set when the reply belongs to someone other than Essentia — a visitor
   *  writing through the contact form, for instance. */
  replyTo?: string;
};

export async function getAdminEmail(): Promise<string | null> {
  try {
    const { data } = await getAdminClient()
      .database.from("profiles")
      .select("email")
      .eq("role", "admin")
      .limit(1)
      .single();
    return (data as { email: string | null } | null)?.email ?? null;
  } catch {
    return null;
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: SendEmailParams) {
  if (!to.includes("@")) throw new Error("Invalid recipient address");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendEmail] RESEND_API_KEY not set — email skipped");
    return { error: null };
  }

  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL ??
    "Essentia <noreply@essentiawellnessclub.com>";

  const adminBcc = await getAdminEmail();

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(adminBcc && adminBcc !== to ? { bcc: adminBcc } : {}),
  });

  if (error) {
    console.error("[sendEmail] Failed to send to", to, ":", error.message);
  }

  return { error };
}

/**
 * Sends many emails in one request.
 *
 * The reminder job used to walk its bookings and await a send per booking,
 * which is the shape that runs into Resend's rate limit — and a 429 there is
 * not a retry, it is a reminder nobody gets, because the row was already
 * stamped. One request carries up to a hundred, so the whole run is normally a
 * single call and there is no loop left to rate-limit.
 *
 * Batches beyond the hundredth go out alongside the first, not after it: they
 * are separate requests to the same API and nothing in one reads the other.
 */
const RESEND_BATCH_LIMIT = 100;

export async function sendEmailBatch(
  emails: SendEmailParams[],
): Promise<{ sent: number; error: string | null }> {
  const valid = emails.filter((email) => email.to.includes("@"));
  if (valid.length === 0) return { sent: 0, error: null };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendEmailBatch] RESEND_API_KEY not set — emails skipped");
    return { sent: 0, error: null };
  }

  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL ??
    "Essentia <noreply@essentiawellnessclub.com>";

  // Once for the whole batch rather than once per recipient.
  const adminBcc = await getAdminEmail();

  const chunks: SendEmailParams[][] = [];
  for (let i = 0; i < valid.length; i += RESEND_BATCH_LIMIT) {
    chunks.push(valid.slice(i, i + RESEND_BATCH_LIMIT));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      resend.batch.send(
        chunk.map((email) => ({
          from,
          to: email.to,
          subject: email.subject,
          html: email.html,
          ...(email.replyTo ? { replyTo: email.replyTo } : {}),
          ...(adminBcc && adminBcc !== email.to ? { bcc: adminBcc } : {}),
        })),
      ),
    ),
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) {
    console.error("[sendEmailBatch] failed:", failure.error.message);
    return { sent: 0, error: failure.error.message };
  }

  return { sent: valid.length, error: null };
}
