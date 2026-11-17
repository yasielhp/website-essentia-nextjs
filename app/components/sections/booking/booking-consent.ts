import type { DetailsState } from "@/types";

/**
 * What the public booking form writes about consent, away from the markup and
 * with its effects handed in, so it can be tested without a browser, a session
 * or the database.
 *
 * The form asks for two things only. Accepting the Terms and the Privacy Policy
 * is what lets the confirmation and the reminder of the appointment be sent by
 * email and WhatsApp (recorded by `recordBookingNoticeConsent`). The optional
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

type Result = { ok: boolean; error?: string };

/** The server actions the form calls, as plain functions so tests can swap them. */
export type ConsentEffects = {
  getAccessToken: () => string | null;
  updateNewsletterForUser: (
    accessToken: string | null,
    userId: string,
    email: string,
    subscribe: boolean,
  ) => Promise<Result>;
  saveOwnWhatsAppConsent: (
    accessToken: string | null,
    input: {
      firstName: string;
      lastName: string;
      phone: string;
      language: "en" | "es";
      marketing: boolean;
    },
  ) => Promise<Result>;
  recordBookingNoticeConsent: (
    accessToken: string | null,
    input: { termsAccepted: true; email?: string },
  ) => Promise<Result>;
  log: (message: string, detail?: unknown) => void;
};

/**
 * The consent writes that come after the details step has saved the contact.
 * Best effort and never throws: a booking is worth more than a flag, and the
 * only cost of a failure is a WhatsApp notice that is not sent.
 *
 * A guest's contact and her "news and offers" choice were already written by
 * `upsert_contact`, so for her only the notice consent is left. A signed-in
 * client has no such call, so her contact is written here first (it is what
 * gives the notice consent a fresh row to land on), the newsletter list is
 * updated when she ticked the box, and then the notice consent follows with
 * the address of her verified session.
 */
export async function writeBookingConsents({
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
  const marketing = details.newsletter === true;

  if (user) {
    if (marketing) {
      void effects
        .updateNewsletterForUser(
          effects.getAccessToken(),
          user.id,
          details.email,
          true,
        )
        .catch(() => undefined);
    }
    try {
      const saved = await effects.saveOwnWhatsAppConsent(
        effects.getAccessToken(),
        {
          firstName: details.firstName,
          lastName: details.lastName,
          phone: details.phone,
          language: locale === "es" ? "es" : "en",
          marketing,
        },
      );
      if (!saved.ok) effects.log("[booking] contact not saved:", saved.error);
    } catch (err) {
      effects.log("[booking] contact not saved:", err);
    }
  }

  // Only when she accepted the Terms and the Policy, which the form requires
  // before it gets this far. A guest's address is the one just saved; a
  // signed-in client's comes from her session on the server, so none is sent.
  if (details.consent !== true) return;
  try {
    const stamped = await effects.recordBookingNoticeConsent(
      user ? effects.getAccessToken() : null,
      user
        ? { termsAccepted: true }
        : { termsAccepted: true, email: details.email },
    );
    if (!stamped.ok) {
      effects.log("[booking] notice consent not saved:", stamped.error);
    }
  } catch (err) {
    effects.log("[booking] notice consent not saved:", err);
  }
}

/** How long the consent writes may hold the booking up. */
export const CONSENT_DEADLINE_MS = 4000;

const realTimer = (fn: () => void, ms: number) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

/**
 * `writeBookingConsents` with a deadline, so a slow or hung server action can
 * never keep a client from reaching the next step. When the time is up the
 * booking goes on (fail-open) and ONE line is logged with no name, address or
 * phone; the write may still land later, or not, and the only cost is a
 * WhatsApp notice that is not sent. The timer is injectable so a test fires it
 * by hand instead of waiting.
 */
export async function writeBookingConsentsWithin({
  deadlineMs = CONSENT_DEADLINE_MS,
  startTimer = realTimer,
  ...args
}: Parameters<typeof writeBookingConsents>[0] & {
  deadlineMs?: number;
  startTimer?: (fn: () => void, ms: number) => () => void;
}): Promise<void> {
  await new Promise<void>((resolve) => {
    const cancel = startTimer(() => {
      args.effects.log(
        "[booking] consent writes took too long; the booking goes on",
        undefined,
      );
      resolve();
    }, deadlineMs);
    writeBookingConsents(args)
      .catch(() => undefined)
      .finally(() => {
        cancel();
        resolve();
      });
  });
}
