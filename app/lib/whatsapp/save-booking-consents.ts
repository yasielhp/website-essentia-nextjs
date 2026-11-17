import { getAdminClient } from "@/lib/insforge-admin";
import { authenticate } from "@/lib/auth-guard";
import { clientIp } from "@/lib/auth-security";
import { createRateLimiter } from "@/lib/campaigns/rate-limit";
import { setNewsletterState } from "@/lib/newsletter";
import {
  publicReply,
  writeBookingConsents,
  type BookingConsentReply,
} from "@/lib/whatsapp/booking-consents";
import {
  recordOwnWhatsAppConsent,
  stampBookingNoticeConsent,
} from "@/lib/whatsapp/self-consent";

/**
 * What the `saveBookingConsents` server action runs, with the real session
 * check, database and newsletter list wired in.
 *
 * SERVER ONLY, and deliberately not a `"use server"` module. The action is a
 * thin door onto this, and the reason it is apart is `deadlineMs`: a test must
 * be able to shorten the deadline, but every argument of an action comes from
 * the browser, so it cannot be one of the action's.
 */

/**
 * A brake on the one action here that anyone can call: 30 calls in ten minutes
 * from one address, far above what a booking needs (one per press of "next").
 * It lives in the memory of the instance (see `createRateLimiter`), so it slows
 * a loop down and guarantees nothing. With no address to count by, as in local
 * development, nothing is limited.
 */
const consentLimiter = createRateLimiter({ max: 30, windowMs: 10 * 60_000 });

async function callerAddress(): Promise<string | null> {
  try {
    return await clientIp();
  } catch {
    return null;
  }
}

/**
 * The consent writes of the booking form's details step, all of them in ONE
 * action: a guest's notice consent; a signed-in client's contact, her
 * notice consent and, when she ticked "news and offers", the newsletter list.
 *
 * One action because Next runs a page's actions one after another: three
 * consent actions were three turns of that queue ahead of the calendar and the
 * confirmation. And it answers within `BOOKING_CONSENT_DEADLINE_MS` whatever
 * the database does (see `writeBookingConsents`), which a timer in the browser
 * could never guarantee.
 *
 * Public on purpose, like the form it serves: a guest has no session. What
 * bounds it:
 *  - `stampBookingNoticeConsent` (a contact written in the last 15 minutes,
 *    with no consent and no STOP yet);
 *  - a signed-in caller's own contact is found by the address of her auth
 *    session (`verifiedEmail`), never by anything the browser sends nor by her
 *    profile's address, which she can rewrite;
 *  - the input is validated before anything is read;
 *  - the answer has one shape (`publicReply`): it never says whether a consent
 *    was stamped, which would tell a stranger that an address has a contact
 *    that was just written;
 *  - a brake on how often one address may call it.
 *
 * It never lifts a STOP and never throws: if it fails or runs out of time the
 * booking goes on and the only loss is the WhatsApp notice. Bookings the team
 * makes from the dashboard do not come through here, so they record no
 * consent.
 */
export async function saveBookingConsentsCore(
  accessToken: string | null,
  input: unknown,
  { deadlineMs }: { deadlineMs?: number } = {},
): Promise<BookingConsentReply> {
  try {
    const address = await callerAddress();
    if (address && !consentLimiter.take(address)) {
      return { ok: false, error: "rate_limited" };
    }

    const result = await writeBookingConsents(
      accessToken,
      input,
      {
        authenticate: async (token) => {
          const caller = await authenticate(token);
          return { userId: caller.userId, email: caller.verifiedEmail };
        },
        saveOwnContact: (sessionEmail, contact) =>
          recordOwnWhatsAppConsent(
            getAdminClient().database,
            sessionEmail,
            contact,
          ),
        stampNotice: (email) =>
          stampBookingNoticeConsent(
            getAdminClient().database,
            email,
            new Date(),
          ),
        subscribeNewsletter: async (userId, sessionEmail) => {
          const listed = await setNewsletterState(sessionEmail, true);
          if (!listed.ok) return { ok: false };
          const { error } = await getAdminClient()
            .database.from("profiles")
            .update({ newsletter_subscribed: true })
            .eq("id", userId);
          return { ok: !error };
        },
      },
      { deadlineMs },
    );
    if (result.error === "timeout") {
      // One line, with no name, address or phone.
      console.error(
        "[booking] consent writes took too long; answered without them",
      );
    }
    return publicReply(result);
  } catch {
    return { ok: false, error: "db" };
  }
}
