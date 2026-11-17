"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { authenticate } from "@/lib/auth-guard";
import { setNewsletterState } from "@/lib/newsletter";
import {
  answerWithin,
  writeBookingConsents,
  type BookingConsentResult,
} from "@/lib/whatsapp/booking-consents";
import {
  readOwnMarketing,
  recordOwnWhatsAppConsent,
  stampBookingNoticeConsent,
} from "@/lib/whatsapp/self-consent";
import { normalizeEmail } from "@/utils/contact";

/**
 * Whether the signed-in client already has "news and offers" on for email and
 * WhatsApp, so the booking form can show the box ticked instead of asking
 * again. Answers "not on" to anyone it cannot identify and never throws: the
 * form works the same without it.
 */
export async function fetchOwnMarketingOn(
  accessToken: string | null,
): Promise<boolean> {
  // Under the same deadline as the writes: it takes a turn of the page's
  // action queue too, and a read that hangs must not hold the booking up.
  return answerWithin(async () => {
    const email = normalizeEmail((await authenticate(accessToken)).email);
    if (!email) return false;
    return readOwnMarketing(getAdminClient().database, email);
  }, false);
}

/**
 * The consent writes of the booking form's details step, all of them in this
 * one action: a guest's notice consent; a signed-in client's contact, her
 * notice consent and, when she ticked "news and offers", the newsletter list.
 *
 * One action because Next runs a page's actions one after another: three
 * consent actions were three turns of that queue ahead of the calendar and the
 * confirmation. And it answers within `BOOKING_CONSENT_DEADLINE_MS` whatever
 * the database does (see `writeBookingConsents`), which a timer in the browser
 * could never guarantee.
 *
 * Public on purpose, like the form it serves: a guest has no session. What
 * bounds it is `stampBookingNoticeConsent` (a contact written in the last 15
 * minutes, with no consent and no STOP yet) and that a signed-in caller's own
 * contact is found by the address of her verified session, never by anything
 * the browser sends. It never lifts a STOP and never throws: if it fails or
 * runs out of time the booking goes on and the only loss is the WhatsApp
 * notice. Bookings the team makes from the dashboard do not come through here,
 * so they record no consent.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function saveBookingConsents(
  accessToken: string | null,
  input: unknown,
): Promise<BookingConsentResult> {
  try {
    const result = await writeBookingConsents(accessToken, input, {
      authenticate,
      saveOwnContact: (sessionEmail, contact) =>
        recordOwnWhatsAppConsent(
          getAdminClient().database,
          sessionEmail,
          contact,
        ),
      stampNotice: (email) =>
        stampBookingNoticeConsent(getAdminClient().database, email, new Date()),
      subscribeNewsletter: async (userId, sessionEmail) => {
        const listed = await setNewsletterState(sessionEmail, true);
        if (!listed.ok) return { ok: false };
        const { error } = await getAdminClient()
          .database.from("profiles")
          .update({ newsletter_subscribed: true })
          .eq("id", userId);
        return { ok: !error };
      },
    });
    if (result.error === "timeout") {
      // One line, with no name, address or phone.
      console.error(
        "[booking] consent writes took too long; answered without them",
      );
    }
    return result;
  } catch {
    return { ok: false, stamped: false, error: "db" };
  }
}
