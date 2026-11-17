import { z } from "zod";
import { consentTarget } from "@/lib/whatsapp/consent";
import type { OwnWhatsAppConsentInput } from "@/types/contact";

/**
 * Every consent write of the booking form's details step, as ONE server action
 * with ONE deadline. SERVER ONLY in what it runs, but pure: the session check
 * and the database are handed in, so it is tested without either.
 *
 * Why one action. Next runs a page's server actions one at a time, in the order
 * they were called, so each consent write used to take a turn of that queue,
 * and a slow one held up whatever the client did next: the calendar's
 * availability, the confirmation of her booking.
 *
 * Why the deadline is here. A timer in the browser cannot free that queue: it
 * only stops the browser waiting, while the action goes on occupying its turn.
 * So the limit is kept on the server, around every read and write: when it is
 * up the action answers "not done" and the queue moves. The only cost is a
 * WhatsApp notice that is not sent; a booking is worth more than a flag.
 *
 * What it writes:
 *  - a guest: the notice consent, on the contact the step has just saved (her
 *    contact and her "news and offers" choice went in with `upsert_contact`);
 *  - a signed-in client whose address in the form is her session's: her
 *    contact, found by the address of her verified session (it is what gives
 *    the notice consent a fresh row to land on), the notice consent on that
 *    same address, and the newsletter list when she ticked the box;
 *  - a signed-in caller who typed ANOTHER address (a booking for somebody
 *    else, or staff with their session open): nothing of her own. The name and
 *    the phone in the form are not hers, so that booking is treated as a
 *    guest's (`consentTarget`).
 *
 * It never lifts a STOP by itself and never throws.
 */

/** How long the consent writes may occupy the page's action queue. */
export const BOOKING_CONSENT_DEADLINE_MS = 3000;

const inputSchema = z.object({
  /** The address typed in the form. It decides nothing by itself: see `consentTarget`. */
  email: z.unknown().optional(),
  firstName: z.unknown().optional(),
  lastName: z.unknown().optional(),
  phone: z.unknown().optional(),
  language: z.enum(["en", "es"]),
  /** The single "news and offers by email and WhatsApp" box. */
  marketing: z.boolean(),
  /** The required box: the Terms, the Policy and the booking notices. */
  termsAccepted: z.boolean(),
});

/** What a contact needs to be written at all. */
const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120),
  phone: z.string().trim().min(6).max(40),
});

/** What the form sends. */
export type BookingConsentInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  language: "en" | "es";
  marketing: boolean;
  termsAccepted: boolean;
};

export type BookingConsentError =
  /** Not what the form sends, or details a contact cannot take. */
  | "invalid"
  /** A token that does not verify. Never falls back to the guest's address. */
  | "auth"
  | "noEmail"
  | "db"
  | "newsletter"
  /** The deadline came first: answered without the writes that were left. */
  | "timeout";

export type BookingConsentResult = {
  ok: boolean;
  /** Whether the notice consent was stamped by this call. */
  stamped: boolean;
  error?: BookingConsentError;
};

type Outcome = { ok: boolean };

/** The session check and the writes, as plain functions so tests can swap them. */
export type BookingConsentEffects = {
  /** Who a token belongs to. Throws when it does not verify. */
  authenticate: (
    accessToken: string,
  ) => Promise<{ userId: string; email: string | null }>;
  /** `upsert_contact` for the caller's own contact. */
  saveOwnContact: (
    sessionEmail: string,
    input: OwnWhatsAppConsentInput,
  ) => Promise<Outcome>;
  /** Stamps the notice consent on a contact that was just written. */
  stampNotice: (email: string) => Promise<Outcome & { stamped?: boolean }>;
  /** Puts the caller on the newsletter list and marks her profile. */
  subscribeNewsletter: (
    userId: string,
    sessionEmail: string,
  ) => Promise<Outcome>;
};

type StartTimer = (fn: () => void, ms: number) => () => void;

const realTimer: StartTimer = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

const TIMED_OUT = Symbol("timed out");
type TimedOut = typeof TIMED_OUT;

/**
 * One clock for the whole action. `within` races a read or a write against it;
 * once it has run out nothing more is started, so a write that answers late
 * cannot set off the ones after it behind the caller's back.
 */
function startDeadline(ms: number, startTimer: StartTimer) {
  let expired = false;
  let cancel = () => {};
  const over = new Promise<TimedOut>((resolve) => {
    cancel = startTimer(() => {
      expired = true;
      resolve(TIMED_OUT);
    }, ms);
  });
  return {
    cancel: () => cancel(),
    within<T>(work: () => Promise<T>): Promise<T | TimedOut> {
      if (expired) return Promise.resolve(TIMED_OUT);
      return Promise.race([work(), over]);
    },
  };
}

/**
 * A consent READ under the same limit: the answer, or `fallback` when the
 * deadline comes first or the read throws. For the read the form makes on
 * arrival (is "news and offers" already on?), which takes a turn of the same
 * queue and must not be able to hold it either.
 */
export async function answerWithin<T>(
  work: () => Promise<T>,
  fallback: T,
  {
    deadlineMs = BOOKING_CONSENT_DEADLINE_MS,
    startTimer = realTimer,
  }: { deadlineMs?: number; startTimer?: StartTimer } = {},
): Promise<T> {
  const deadline = startDeadline(deadlineMs, startTimer);
  try {
    const answer = await deadline.within(async () => {
      try {
        return await work();
      } catch {
        return fallback;
      }
    });
    return answer === TIMED_OUT ? fallback : (answer as T);
  } finally {
    deadline.cancel();
  }
}

/** A write that fails or throws is "not done", never an exception. */
const attempt =
  <T extends Outcome>(work: () => Promise<T>) =>
  async (): Promise<T | { ok: false }> => {
    try {
      return await work();
    } catch {
      return { ok: false };
    }
  };

export async function writeBookingConsents(
  accessToken: string | null,
  raw: unknown,
  effects: BookingConsentEffects,
  {
    deadlineMs = BOOKING_CONSENT_DEADLINE_MS,
    startTimer = realTimer,
  }: { deadlineMs?: number; startTimer?: StartTimer } = {},
): Promise<BookingConsentResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, stamped: false, error: "invalid" };
  const input = parsed.data;

  const deadline = startDeadline(deadlineMs, startTimer);
  const errors: BookingConsentError[] = [];
  let stamped = false;
  const done = (): BookingConsentResult =>
    errors.length > 0
      ? { ok: false, stamped, error: errors[0] }
      : { ok: true, stamped };
  const late = (): BookingConsentResult => ({
    ok: false,
    stamped,
    error: "timeout",
  });

  try {
    let session: { userId: string; email: string | null } | null = null;
    if (accessToken) {
      const who = await deadline.within(async () => {
        try {
          return await effects.authenticate(accessToken);
        } catch {
          return null;
        }
      });
      if (who === TIMED_OUT) return late();
      if (!who) return { ok: false, stamped: false, error: "auth" };
      session = who;
    }

    // Her own contact only when the form carries her own address. With any
    // other address in it she is booking for somebody else: her contact is not
    // touched and that booking's consent goes the way a guest's does.
    const { email, own } = consentTarget({
      signedIn: session !== null,
      sessionEmail: session?.email ?? null,
      formEmail: input.email,
    });
    if (!email) {
      // With nothing to stamp there is nothing to do here at all.
      if (!input.termsAccepted) return done();
      return { ok: false, stamped: false, error: "noEmail" };
    }

    if (own) {
      const contact = contactSchema.safeParse(input);
      if (!contact.success) {
        errors.push("invalid");
      } else {
        const saved = await deadline.within(
          attempt(() =>
            effects.saveOwnContact(email, {
              ...contact.data,
              language: input.language,
              marketing: input.marketing,
            }),
          ),
        );
        if (saved === TIMED_OUT) return late();
        if (!saved.ok) errors.push("db");
      }
    }

    if (input.termsAccepted) {
      const notice = await deadline.within(
        attempt(() => effects.stampNotice(email)),
      );
      if (notice === TIMED_OUT) return late();
      if (!notice.ok) errors.push("db");
      else stamped = "stamped" in notice && notice.stamped === true;
    }

    // Last, because the contact above already carries her yes, which is what
    // the campaigns read: the list at Resend and the flag on her profile are
    // copies, and the first thing to go if time runs short.
    if (session && own && input.marketing) {
      const { userId } = session;
      const listed = await deadline.within(
        attempt(() => effects.subscribeNewsletter(userId, email)),
      );
      if (listed === TIMED_OUT) return late();
      if (!listed.ok) errors.push("newsletter");
    }

    return done();
  } catch {
    return { ok: false, stamped, error: "db" };
  } finally {
    deadline.cancel();
  }
}
