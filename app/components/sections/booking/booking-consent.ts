import type { DetailsState } from "@/types";
import type {
  BookingConsentInput,
  BookingConsentReply,
} from "@/lib/whatsapp/booking-consents";

/**
 * What the public booking form writes about consent, away from the markup and
 * with its effects handed in, so it can be tested without a browser, a session
 * or the database.
 *
 * The form asks for two things only. Accepting the Terms and the Privacy Policy
 * is what lets the confirmation and the reminder of the appointment be sent by
 * email and WhatsApp (recorded by `saveBookingConsents`). The optional
 * box is "news and offers", and it is ONE choice for both channels: ticked it
 * turns on the newsletter and WhatsApp marketing together. Unticked is `null`,
 * never `false`: it means "do not touch", so it does not undo a yes given
 * before. A withdrawal is the unsubscribe link in an email, a BAJA/STOP reply on
 * WhatsApp, or the centre in the dashboard.
 *
 * After a STOP the order matters, on purpose. Ticking "news and offers" is an
 * explicit new yes: `upsert_contact` clears the STOP and withdraws the booking
 * notices (a STOP is global), and then the notice consent is stamped again, so a
 * client who left gets her notices back together with the news she just asked
 * for. Booking again WITHOUT the tick lifts nothing. Pinned in
 * `self-consent.test.ts`.
 */

/** The consent parameters of `upsert_contact` for a guest. */
export function contactConsentArgs(details: Pick<DetailsState, "newsletter">): {
  p_newsletter: true | null;
  p_whatsapp_marketing: true | null;
} {
  const ticked = details.newsletter === true;
  return {
    p_newsletter: ticked ? true : null,
    p_whatsapp_marketing: ticked ? true : null,
  };
}

/**
 * Whether a signed-in caller is booking for somebody else: the address in the
 * form is not the one of her session (case and surrounding spaces aside). It
 * happens when a client books for another person, and when staff book with
 * their own session open.
 *
 * Then the name and the phone in the form are not hers, so the step writes
 * that person's contact the way it writes a guest's, and the server leaves the
 * caller's own contact alone. The server decides that by itself, from the
 * verified session (`consentTarget`); this is only how the browser knows which
 * contact to write. A session whose address is not known here changes nothing.
 */
export function bookingForSomeoneElse(
  sessionEmail: string | null | undefined,
  formEmail: string,
): boolean {
  const clean = (value: string | null | undefined) =>
    value?.trim().toLowerCase() ?? "";
  const own = clean(sessionEmail);
  const typed = clean(formEmail);
  return own !== "" && typed !== "" && own !== typed;
}

/** What the form calls, as plain functions so tests can swap them. */
export type ConsentEffects = {
  getAccessToken: () => string | null;
  /** The one server action that makes every consent write of the step. */
  saveBookingConsents: (
    accessToken: string | null,
    input: BookingConsentInput,
  ) => Promise<BookingConsentReply>;
  log: (message: string, detail?: unknown) => void;
};

/**
 * The consent writes that come after the details step has saved the contact,
 * sent as ONE server action. Best effort and never throws: a booking is worth
 * more than a flag, and the only cost of a failure is a WhatsApp notice that is
 * not sent.
 *
 * One action, not one per write, because Next runs a page's actions one after
 * another: each used to take a turn of that queue ahead of the calendar and the
 * confirmation. And there is no timer here, on purpose. A deadline in the
 * browser only stops the browser waiting; the action keeps its turn of the
 * queue all the same. The limit is on the server, inside the action
 * (`BOOKING_CONSENT_DEADLINE_MS`).
 *
 * A guest's contact and her "news and offers" choice were already written by
 * `upsert_contact`, so for her only the notice consent is left, and with the
 * Terms unaccepted (which the form does not allow) there is nothing to send. A
 * signed-in client has no such call, so the action writes her contact first,
 * from the address of her verified session; unless the form carries another
 * address (`bookingForSomeoneElse`), in which case the action treats the
 * booking as a guest's and her own contact is not touched.
 */
export async function sendBookingConsents({
  user,
  locale,
  details,
  effects,
}: {
  user: { id: string } | null;
  locale: string;
  details: DetailsState;
  effects: ConsentEffects;
}): Promise<void> {
  const termsAccepted = details.consent === true;
  if (!user && !termsAccepted) return;

  try {
    const result = await effects.saveBookingConsents(
      user ? effects.getAccessToken() : null,
      {
        email: details.email,
        firstName: details.firstName,
        lastName: details.lastName,
        phone: details.phone,
        language: locale === "es" ? "es" : "en",
        marketing: details.newsletter === true,
        termsAccepted,
      },
    );
    // The reason only: never a name, an address or a phone.
    if (!result.ok) effects.log("[booking] consents not saved:", result.error);
  } catch {
    effects.log("[booking] consents not saved:", "failed");
  }
}
