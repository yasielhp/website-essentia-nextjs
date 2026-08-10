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

/**
 * The address that gets a copy of everything.
 *
 * The admin profile was already blind-copied, but that is whoever holds the
 * admin role at the time, and the centre wants one inbox that sees every
 * booking regardless of who that is. Set `EMAIL_BCC` to change it without a
 * deploy; the fallback is the address the centre asked for.
 */
const STANDING_BCC = process.env.EMAIL_BCC ?? "essentiabyyuli@gmail.com";

/**
 * Everyone who should receive a blind copy of a message to `recipient`.
 *
 * Deduplicated, and never the recipient themselves — a client who is also the
 * admin should get one copy, not two.
 */
async function blindCopies(recipient: string): Promise<string[]> {
  const adminEmail = await getAdminEmail();
  const all = [STANDING_BCC, adminEmail].filter((address): address is string =>
    Boolean(address),
  );
  return [...new Set(all)].filter(
    (address) => address.toLowerCase() !== recipient.toLowerCase(),
  );
}

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

  const bcc = await blindCopies(to);

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
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
  const adminEmail = await getAdminEmail();

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
          ...(() => {
            const bcc = [STANDING_BCC, adminEmail]
              .filter((address): address is string => Boolean(address))
              .filter(
                (address, index, all) =>
                  all.indexOf(address) === index &&
                  address.toLowerCase() !== email.to.toLowerCase(),
              );
            return bcc.length > 0 ? { bcc } : {};
          })(),
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
