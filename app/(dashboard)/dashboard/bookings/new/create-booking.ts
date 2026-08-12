import { z } from "zod";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { getSessionUser } from "@/actions/auth";
import { notifyBooking } from "@/actions/booking-notifications";
import { notifyStaffWhatsApp } from "@/actions/staff-whatsapp";
import { pushBookingToCalendarsAction } from "@/actions/calendar-propagate";
import { toStoredGender } from "@/constants/gender";
import { localDateStr } from "@/utils/format";
import {
  resolvePrice,
  type FormState,
  type Service,
  type Tier,
} from "./form-state";

/**
 * Taking a booking at the desk: the checks, the write, and telling everyone.
 *
 * The screen used to hold all of it in one `handleSubmit` of two hundred and
 * eighty lines. None of it is about drawing a form, and several steps carry
 * hard-won rules — the contact link, the session check, the client's own
 * language on the email — that are easier to keep when they are not buried in
 * markup. The edit screen has its own twin of this in `save-booking`.
 */

/** The booking as the form has it, with the service and session type it names. */
export type NewBookingDraft = FormState & {
  service: Service | null;
  tier: Tier | null;
  /** The role of whoever is filling it in; a partner's bookings are theirs. */
  role: string | null;
};

/** Every refusal this form can give, already in the reader's language. */
export type ValidationMessages = {
  serviceRequired: string;
  firstNameRequired: string;
  emailRequired: string;
  emailInvalid: string;
  reservationRequired: string;
};

/** The first thing wrong with the draft, or null when nothing is. */
export function validateNewBooking(
  draft: NewBookingDraft,
  messages: ValidationMessages,
): string | null {
  if (!draft.serviceId) return messages.serviceRequired;
  if (!draft.firstName.trim()) return messages.firstNameRequired;
  if (!draft.email.trim()) return messages.emailRequired;
  /**
   * The address was only checked for being non-empty, so `oliverthomp.co.uk`
   * — no @ — was accepted, saved, and could never be matched to a contact.
   * Same rule the public booking form uses.
   */
  if (!z.email().safeParse(draft.email.trim()).success)
    return messages.emailInvalid;
  if (
    (draft.location === "habitacion" || draft.location === "centro") &&
    !draft.reservationNumber.trim()
  )
    return messages.reservationRequired;
  return null;
}

function dateOf(draft: NewBookingDraft): string | null {
  return draft.selectedDate ? localDateStr(draft.selectedDate) : null;
}

function durationOf(draft: NewBookingDraft): string | null {
  return draft.tier?.duration_minutes != null
    ? `${draft.tier.duration_minutes} min`
    : null;
}

function clientNameOf(draft: NewBookingDraft): string {
  return [draft.firstName.trim(), draft.lastName.trim()]
    .filter(Boolean)
    .join(" ");
}

/** The address as the row stores it: JSON whose shape depends on the place. */
function addressOf(draft: NewBookingDraft): string | null {
  if (draft.location === "habitacion" || draft.location === "centro")
    return JSON.stringify({
      roomNumber: draft.roomNumber,
      reservationNumber: draft.reservationNumber,
    });
  if (draft.location === "domicilio") return JSON.stringify(draft.address);
  return null;
}

/**
 * Links the client's contact record, or says why it could not.
 *
 * Bookings created here never set `contact_id`, which is why 81 of 100 rows had
 * none and a client's history looked empty on their own page. `upsert_contact`
 * creates the contact or returns the existing one, exactly as the public
 * booking flow does.
 *
 * A booking is worth more than its contact link, so a failure does not stop the
 * write — but it is said out loud. Swallowing it is how every dashboard booking
 * came to be saved with no contact at all.
 */
async function linkContact(draft: NewBookingDraft): Promise<string | null> {
  const email = draft.email.trim();
  if (!email) return null;

  const { data: contactUuid, error } = await insforge.database.rpc(
    "upsert_contact",
    {
      p_email: email,
      p_first_name: draft.firstName.trim(),
      p_last_name: draft.lastName.trim(),
      p_phone: draft.phone.trim() || null,
      p_language: draft.language,
      p_gender: toStoredGender(draft.gender),
    },
  );

  if (error) {
    console.error(
      "[booking] upsert_contact failed; the booking will have no contact:",
      error,
    );
  }
  return (contactUuid as string | null) ?? null;
}

export type CreateResult =
  { ok: true; bookingId: string } | { ok: false; error: string };

/**
 * Writes the booking.
 *
 * The id is generated here so the insert does not need a RETURNING clause —
 * RETURNING would require a SELECT policy covering the new row.
 */
export async function createBooking(
  draft: NewBookingDraft,
  messages: { sessionExpired: string; createFailed: string },
): Promise<CreateResult> {
  // An expired token makes the SDK fall back to the anon key, which then fails
  // the partner RLS policies. Check the session before writing anything.
  //
  // Asked on the server, which is the side that holds the cookie: the browser
  // client keeps the access token but never a user object, so its own
  // `getCurrentUser()` answers "nobody" after every page load — and moving into
  // the dashboard is always a full page load.
  const { user: sessionUser } = await getSessionUser();
  if (!sessionUser) return { ok: false, error: messages.sessionExpired };
  const authUserId = sessionUser.id;

  const bookingId = crypto.randomUUID();
  const contactId = await linkContact(draft);

  const { error } = await insforge.database.from("bookings").insert([
    {
      id: bookingId,
      service_id: draft.serviceId,
      service_title: draft.service?.title ?? draft.serviceId,
      tier_id: draft.tierId || null,
      price_eur: draft.tier ? resolvePrice(draft.tier, draft.location) : null,
      duration: durationOf(draft),
      date: dateOf(draft),
      time: draft.selectedTime || null,
      location: draft.location || null,
      location_address: addressOf(draft),
      ...(draft.staffId ? { staff_id: draft.staffId } : {}),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
      first_name: draft.firstName.trim(),
      last_name: draft.lastName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim() || null,
      ...(contactId ? { contact_id: contactId } : {}),
      status: "confirmed",
      ...(draft.role === "partner" ? { partner_id: authUserId } : {}),
      created_by_user_id: authUserId,
      ...(draft.role ? { created_by_role: draft.role } : {}),
    },
  ]);

  if (error) {
    return {
      ok: false,
      error: (error as { message?: string })?.message ?? messages.createFailed,
    };
  }

  return { ok: true, bookingId };
}

/**
 * Puts the new booking on every calendar that should hold it.
 *
 * This used to build its own event and post it to the service's calendar, and
 * only that one — so a booking taken at the desk never reached the
 * professional's phone or the administrator's mirror until the hourly job ran,
 * and once services stopped holding calendars of their own it reached nothing
 * at all. The event is now built where every other calendar entry is built,
 * from the row rather than from the form.
 */
async function writeCalendarEvent(bookingId: string): Promise<void> {
  try {
    await pushBookingToCalendarsAction(getAccessToken(), bookingId);
  } catch {
    // fail-open: calendar error must not block navigation
  }
}

/**
 * Everything that happens once the booking exists: the client's email, the
 * professional's WhatsApp, and the calendar entry.
 */
export async function announceNewBooking(
  bookingId: string,
  draft: NewBookingDraft,
): Promise<void> {
  const dateStr = dateOf(draft);

  if (draft.email.trim() && dateStr) {
    try {
      await notifyBooking(getAccessToken(), {
        bookingId,
        event: "confirmed",
        clientName: clientNameOf(draft),
        clientEmail: draft.email.trim(),
        clientPhone: draft.phone.trim() || null,
        service: draft.service?.title ?? draft.serviceId,
        serviceId: draft.serviceId,
        sessionType: draft.tier?.label ?? null,
        date: dateStr,
        time: draft.selectedTime || "",
        duration: durationOf(draft),
        // The client's language, not the language of whoever is at the desk.
        locale: draft.language === "en" ? "en" : "es",
      });
    } catch {
      // Notification failed silently — booking is already saved
    }
  }

  // The professional gets it on WhatsApp too: whoever took this booking at the
  // desk is not going to walk down the corridor to say so.
  if (draft.staffId) {
    await notifyStaffWhatsApp(getAccessToken(), {
      bookingId,
      staffId: draft.staffId,
      event: "assigned",
    });
  }

  await writeCalendarEvent(bookingId);
}
