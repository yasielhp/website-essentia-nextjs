import { Resend } from "resend";
import { getAdminClient } from "@/lib/insforge-admin";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  /** Set when the reply belongs to someone other than Essentia — a visitor
   *  writing through the contact form, for instance. */
  replyTo?: string;
  /**
   * Set to `false` for anything the recipient alone may see.
   *
   * Everything the centre sends is blind-copied to the office, which is right
   * for a booking and wrong for a password: the account-lock email carries the
   * link that opens the account, and a copy in the office inbox would hand
   * that link to whoever reads it.
   *
   * Also `false` for a campaign: the office wants to know a campaign went out,
   * not to receive it two thousand times.
   */
  blindCopy?: boolean;
  /** Resend tags, e.g. `{ campaign_id }`, echoed back in every webhook event for this email. */
  tags?: Record<string, string>;
  /** Extra SMTP headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
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
  return withoutRecipient(copyList(adminEmail), recipient);
}

/** The standing copy and the admin, once each. */
function copyList(adminEmail: string | null): string[] {
  const all = [STANDING_BCC, adminEmail].filter((address): address is string =>
    Boolean(address),
  );
  return [...new Set(all)];
}

function withoutRecipient(copies: string[], recipient: string): string[] {
  return copies.filter(
    (address) => address.toLowerCase() !== recipient.toLowerCase(),
  );
}

/** Resend wants its tags as a list of pairs, not a map. */
function resendTags(tags: Record<string, string>) {
  return Object.entries(tags).map(([name, value]) => ({ name, value }));
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
  blindCopy = true,
  tags,
  headers,
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

  const bcc = blindCopy ? await blindCopies(to) : [];

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
    ...(tags ? { tags: resendTags(tags) } : {}),
    ...(headers ? { headers } : {}),
  });

  if (error) {
    console.error("[sendEmail] Failed to send to", to, ":", error.message);
  }

  // The id travels back so the booking history can keep it: it is what the
  // Resend webhook quotes when the message is delivered, opened or bounces, and
  // without it a callback has no row to land on.
  return { error, id: data?.id ?? null };
}

/**
 * Sends many emails in as few requests as Resend allows.
 *
 * The reminder job used to walk its bookings and await a send per booking,
 * which is the shape that runs into Resend's rate limit — and a 429 there is
 * not a retry, it is a reminder nobody gets, because the row was already
 * stamped. One request carries up to a hundred, so a reminder run is normally
 * a single call and there is no loop left to rate-limit.
 *
 * A campaign is another matter: a few thousand recipients is fifty requests,
 * and Resend takes two a second. So the chunks go out one after another with a
 * pause between them, not all at once — firing fifty requests together is the
 * per-booking loop again, only faster. A chunk that fails is logged and left
 * behind while the rest still go: the campaign log can see which rows never
 * got an id and send those again, which it could not do if one bad chunk took
 * the whole run down with it.
 *
 * The ids come back in the order the emails went in, one slot per input and
 * `null` where nothing was sent — an address without an `@`, a chunk that
 * failed, a run with no API key. The campaign log keeps one row per recipient
 * and the Resend webhook names an email by its id when it is delivered, opened
 * or bounces; without the id there is no row for the callback to land on.
 */
const RESEND_BATCH_LIMIT = 100;

/** Comfortably under Resend's two requests a second. */
const RESEND_BATCH_PAUSE_MS = 600;

export async function sendEmailBatch(
  emails: SendEmailParams[],
): Promise<{ sent: number; ids: (string | null)[]; error: string | null }> {
  const ids: (string | null)[] = emails.map(() => null);

  // Positions into `emails`, so every id can be written back where its email
  // came from even after the invalid ones are skipped.
  const valid = emails.flatMap((email, index) =>
    email.to.includes("@") ? [index] : [],
  );
  if (valid.length === 0) return { sent: 0, ids, error: null };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendEmailBatch] RESEND_API_KEY not set — emails skipped");
    return { sent: 0, ids, error: null };
  }

  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL ??
    "Essentia <noreply@essentiawellnessclub.com>";

  // Once for the whole batch rather than once per recipient.
  const copies = copyList(await getAdminEmail());

  let error: string | null = null;

  for (let start = 0; start < valid.length; start += RESEND_BATCH_LIMIT) {
    if (start > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, RESEND_BATCH_PAUSE_MS),
      );
    }
    const chunk = valid.slice(start, start + RESEND_BATCH_LIMIT);

    try {
      const { data, error: chunkError } = await resend.batch.send(
        chunk.map((index) => {
          const email = emails[index];
          const bcc =
            email.blindCopy === false ? [] : withoutRecipient(copies, email.to);
          return {
            from,
            to: email.to,
            subject: email.subject,
            html: email.html,
            ...(email.replyTo ? { replyTo: email.replyTo } : {}),
            ...(bcc.length > 0 ? { bcc } : {}),
            ...(email.tags ? { tags: resendTags(email.tags) } : {}),
            ...(email.headers ? { headers: email.headers } : {}),
          };
        }),
      );

      if (chunkError || !data) {
        const message = chunkError?.message ?? "Resend returned no ids";
        console.error("[sendEmailBatch] chunk failed:", message);
        error ??= message;
        continue;
      }

      chunk.forEach((index, position) => {
        ids[index] = data.data[position]?.id ?? null;
      });
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : String(thrown);
      console.error("[sendEmailBatch] chunk failed:", message);
      error ??= message;
    }
  }

  const sent = ids.filter((id) => id !== null).length;
  return { sent, ids, error };
}
