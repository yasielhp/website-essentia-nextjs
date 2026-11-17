"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { authenticate } from "@/lib/auth-guard";
import {
  answerWithin,
  type BookingConsentReply,
} from "@/lib/whatsapp/booking-consents";
import { saveBookingConsentsCore } from "@/lib/whatsapp/save-booking-consents";
import { readOwnMarketing } from "@/lib/whatsapp/self-consent";
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
    // The address of the auth session, not the profile's: she can rewrite the
    // second, and it would then answer for somebody else's contact.
    const email = normalizeEmail(
      (await authenticate(accessToken)).verifiedEmail,
    );
    if (!email) return false;
    return readOwnMarketing(getAdminClient().database, email);
  }, false);
}

/**
 * The consent writes of the booking form's details step, all of them in this
 * one action: a guest's notice consent; a signed-in client's contact, her
 * notice consent and, when she ticked "news and offers", the newsletter list.
 *
 * Public on purpose, like the form it serves: a guest has no session. What it
 * does, what bounds it and why it answers within three seconds whatever the
 * database does are in `saveBookingConsentsCore`. It takes the caller's token
 * and the form's input and nothing else: the deadline is not an argument here,
 * because an action's arguments come from the browser.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function saveBookingConsents(
  accessToken: string | null,
  input: unknown,
): Promise<BookingConsentReply> {
  return saveBookingConsentsCore(accessToken, input);
}
