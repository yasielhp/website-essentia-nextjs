import { z } from "zod";
import { getAccessToken } from "@/lib/client-session";
import { updateBookingByAdmin } from "@/actions/booking-draft";
import { notifyBooking } from "@/actions/booking-notifications";
import { notifyStaffWhatsApp } from "@/actions/staff-whatsapp";
import {
  pushBookingToCalendarsAction,
  syncBookingToCalendars,
} from "@/actions/calendar-propagate";
import { localDateStr } from "@/utils/format";
import {
  resolvePrice,
  type FormState,
  type Service,
  type Tier,
} from "./form-state";
import type {
  DashboardLocation,
  LocationAddress,
} from "../../_shared/location-options";

/**
 * Saving a booking somebody has changed, and telling everyone who needs to know.
 *
 * The screen used to hold all of this in one `handleSubmit` of three hundred and
 * fifty lines: the checks, the write, the client's email, the professional's
 * WhatsApp, the calendars. None of it is about drawing anything, and every one
 * of those steps has its own rules about what counts as a change.
 */

/** The booking as it was when the screen loaded it. */
export type BookingSnapshot = {
  status: string;
  date: string | null;
  time: string;
  serviceId: string;
  staffId: string;
  googleEventId: string | null;
};

/** The booking as the form now has it. */
export type BookingDraft = {
  serviceId: string;
  tierId: string;
  location: DashboardLocation | "";
  roomNumber: string;
  reservationNumber: string;
  notes: string;
  address: LocationAddress;
  selectedDate: Date | null;
  selectedTime: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  staffId: string;
  service: Service | null;
  tier: Tier | null;
};

/** The form's own values, paired with the service and session type they name. */
export function toDraft(
  form: FormState,
  service: Service | null,
  tier: Tier | null,
): BookingDraft {
  return {
    serviceId: form.serviceId,
    tierId: form.tierId,
    location: form.location,
    roomNumber: form.roomNumber,
    reservationNumber: form.reservationNumber,
    notes: form.notes,
    address: form.address,
    selectedDate: form.selectedDate,
    selectedTime: form.selectedTime,
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    status: form.status,
    staffId: form.staffId,
    service,
    tier,
  };
}

/** Every refusal this form can give, already in the reader's language. */
export type ValidationMessages = {
  serviceRequired: string;
  firstNameRequired: string;
  emailRequired: string;
  emailInvalid: string;
  reservationRequired: string;
  dateRequired: string;
  timeRequired: string;
};

/** The first thing wrong with the draft, or null when nothing is. */
export function validateBookingDraft(
  draft: BookingDraft,
  messages: ValidationMessages,
): string | null {
  if (!draft.serviceId) return messages.serviceRequired;
  if (!draft.firstName.trim()) return messages.firstNameRequired;
  if (!draft.email.trim()) return messages.emailRequired;
  // Same check the create screen and the public form apply.
  if (!z.email().safeParse(draft.email.trim()).success)
    return messages.emailInvalid;
  if (
    (draft.location === "habitacion" || draft.location === "centro") &&
    !draft.reservationNumber.trim()
  )
    return messages.reservationRequired;
  if (!draft.selectedDate) return messages.dateRequired;
  if (!draft.selectedTime) return messages.timeRequired;
  return null;
}

function dateOf(draft: BookingDraft): string | null {
  return draft.selectedDate ? localDateStr(draft.selectedDate) : null;
}

function durationOf(draft: BookingDraft): string | null {
  return draft.tier?.duration_minutes != null
    ? `${draft.tier.duration_minutes} min`
    : null;
}

function clientNameOf(draft: BookingDraft): string {
  return [draft.firstName.trim(), draft.lastName.trim()]
    .filter(Boolean)
    .join(" ");
}

/** The address as the row stores it: JSON whose shape depends on the place. */
function addressOf(draft: BookingDraft): string | null {
  if (draft.location === "habitacion" || draft.location === "centro")
    return JSON.stringify({
      roomNumber: draft.roomNumber,
      reservationNumber: draft.reservationNumber,
    });
  if (draft.location === "domicilio") return JSON.stringify(draft.address);
  return null;
}

/**
 * Writes the row. Nothing is announced until this succeeds.
 *
 * The history entries — the move, the reassignment, the confirmation — are
 * written by `updateBookingByAdmin` itself, from the row as it stood against
 * the payload below. Not from here: this file runs in the browser, and the log
 * is written with the service key. Composing the lines on this side would mean
 * a public endpoint that accepts prose for the record the centre trusts, and
 * would let a save that the database refused still leave a trail saying it
 * happened.
 */
export async function updateBooking(
  token: string | null,
  id: string,
  draft: BookingDraft,
): Promise<{ error: string | null }> {
  const { error } = await updateBookingByAdmin(token, id, {
    service_id: draft.serviceId,
    service_title: draft.service?.title ?? draft.serviceId,
    tier_id: draft.tierId || null,
    price_eur: draft.tier ? resolvePrice(draft.tier, draft.location) : null,
    duration: durationOf(draft),
    date: dateOf(draft),
    time: draft.selectedTime || null,
    location: draft.location || null,
    location_address: addressOf(draft),
    staff_id: draft.staffId || null,
    notes: draft.notes.trim() || null,
    first_name: draft.firstName.trim(),
    last_name: draft.lastName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim() || null,
    status: draft.status,
  });

  return { error: error ?? null };
}

/**
 * What the client is told, and only when something they care about moved.
 *
 * Confirming and cancelling each have their own message; a change of hour with
 * no change of state is a reschedule. A failure here is swallowed: the booking
 * is already saved, and an email that did not go out is not a reason to leave
 * somebody staring at a form.
 */
async function tellClient(
  token: string | null,
  id: string,
  draft: BookingDraft,
  orig: BookingSnapshot,
): Promise<void> {
  if (!draft.email) return;

  const dateStr = dateOf(draft);
  const statusChanged = draft.status !== orig.status;
  const dateTimeChanged =
    dateStr !== orig.date || (draft.selectedTime || "") !== orig.time;

  const event = statusChanged
    ? draft.status === "confirmed"
      ? "confirmed"
      : draft.status === "cancelled"
        ? "cancelled"
        : null
    : dateTimeChanged
      ? "rescheduled"
      : null;

  if (event) {
    try {
      await notifyBooking(token, {
        bookingId: id,
        event,
        clientName: clientNameOf(draft),
        clientEmail: draft.email.trim(),
        service: draft.service?.title ?? draft.serviceId,
        serviceId: draft.serviceId,
        sessionType: draft.tier?.label ?? null,
        date: dateStr ?? orig.date ?? "",
        time: draft.selectedTime || orig.time,
        duration: durationOf(draft),
      });
    } catch {
      // Notification failed silently — booking is already saved
    }
  }

  // A cancelled booking is taken off the calendars by `tellStaff`, which does
  // it for every calendar that holds it rather than only the service's.
}

/**
 * What the professional is told.
 *
 * Separate from the client's message because that one also needs a client
 * email, and a booking taken over the phone without one still has someone who
 * has to turn up for it.
 */
async function tellStaff(
  token: string | null,
  id: string,
  draft: BookingDraft,
  orig: BookingSnapshot,
): Promise<void> {
  const dateStr = dateOf(draft);
  const statusChanged = draft.status !== orig.status;
  const dateTimeChanged =
    dateStr !== orig.date || (draft.selectedTime || "") !== orig.time;
  const staffChanged = (draft.staffId || "") !== (orig.staffId || "");

  if (statusChanged && draft.status === "cancelled") {
    // Whoever was holding the slot, whether or not it changed hands in the
    // same save.
    const holder = draft.staffId || orig.staffId;
    if (holder) {
      await notifyStaffWhatsApp(token, {
        bookingId: id,
        staffId: holder,
        event: "cancelled",
      });
    }
  } else if (staffChanged) {
    // Reassignment wins over a simultaneous time change: the message the new
    // person gets already carries the new time, so a second `rescheduled`
    // would only say the same thing twice.
    if (orig.staffId) {
      await notifyStaffWhatsApp(token, {
        bookingId: id,
        staffId: orig.staffId,
        event: "unassigned",
      });
    }
    if (draft.staffId) {
      await notifyStaffWhatsApp(token, {
        bookingId: id,
        staffId: draft.staffId,
        event: "assigned",
      });
    }
  } else if (dateTimeChanged && draft.staffId) {
    await notifyStaffWhatsApp(token, {
      bookingId: id,
      staffId: draft.staffId,
      event: "rescheduled",
    });
  }

  // Every calendar that holds this booking, not just the service's. A move used
  // to be corrected on one and left wrong on the professional's phone and on
  // the administrator's mirror.
  await syncBookingToCalendars(
    token,
    id,
    draft.status === "cancelled" ? "removed" : "updated",
  );
}

/**
 * Puts the booking on every calendar that should hold it, once it is worth
 * being there.
 *
 * This used to build its own event and post it to the service's calendar, and
 * only that one — so an edit that confirmed a booking never reached the
 * professional's phone or the administrator's mirror until the hourly job ran,
 * and once services stopped holding calendars of their own it reached nothing
 * at all. Copies that already exist are corrected by `tellStaff`; this only
 * creates the ones that are missing.
 */
async function writeCalendarEvent(id: string): Promise<void> {
  try {
    await pushBookingToCalendarsAction(getAccessToken(), id);
  } catch {
    // fail-open: calendar error must not block navigation
  }
}

/**
 * Everything that happens after the row is written.
 *
 * Returns the booking as it now stands, so a second save compares against what
 * was just stored rather than against what was loaded — otherwise confirming
 * twice sends the confirmation twice.
 */
export async function announceBookingSaved({
  token,
  id,
  draft,
  original,
}: {
  token: string | null;
  id: string;
  draft: BookingDraft;
  original: BookingSnapshot | null;
}): Promise<BookingSnapshot | null> {
  if (original) {
    await tellClient(token, id, draft, original);
    await tellStaff(token, id, draft, original);
  }

  await writeCalendarEvent(id);

  if (!original) return null;
  return {
    status: draft.status,
    date: dateOf(draft),
    time: draft.selectedTime,
    serviceId: draft.serviceId,
    staffId: draft.staffId,
    googleEventId: original.googleEventId,
  };
}
