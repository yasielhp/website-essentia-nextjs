import { getAdminClient } from "@/lib/insforge-admin";
import {
  deleteCalendarEvent,
  getStaffAccessToken,
  getValidAccessToken,
  updateCalendarEvent,
  type GoogleCalendarEvent,
} from "@/lib/google-calendar";
import { addMinutesToTime, parseDurationMinutes } from "@/utils/format";
import {
  bookingDescription,
  bookingLocation,
  bookingSummary,
  CALENDAR_BOOKING_FIELDS,
  type CalendarBooking,
} from "@/lib/calendar-event";

const TIMEZONE = "Atlantic/Canary";

/**
 * Carries a change to a booking to every calendar that holds it.
 *
 * A booking can sit on several: the service's, the professional's, and an
 * administrator's mirror. Moving one from Monday to Tuesday used to update the
 * service's copy and leave the rest on Monday; cancelling from the client's own
 * link updated none of them at all. The result was calendars that disagreed
 * with the dashboard, which is worse than calendars with nothing on them —
 * somebody turns up for an appointment that no longer exists.
 *
 * SERVER ONLY. Never throws: a calendar that refuses is logged and the rest
 * still change, because the booking itself is already saved and the person
 * doing the saving cannot fix Google from where they are standing.
 */
type Target = {
  label: string;
  accessToken: string;
  /** Null when this calendar does not have the booking yet. */
  eventId: string | null;
  /** How to remember a newly created event. */
  remember: (eventId: string) => Promise<void>;
  /** How to forget it once the event is gone. */
  forget: () => Promise<void>;
};

type BookingRow = CalendarBooking & {
  service_id: string | null;
  staff_id: string | null;
  google_event_id: string | null;
  service_tiers?: { label: string | null } | { label: string | null }[] | null;
};

function withTier(booking: BookingRow): CalendarBooking {
  const tier = Array.isArray(booking.service_tiers)
    ? booking.service_tiers[0]
    : booking.service_tiers;
  return { ...booking, tier_label: tier?.label ?? null };
}

function eventBody(booking: BookingRow): GoogleCalendarEvent | null {
  if (!booking.date || !booking.time) return null;
  const flat = withTier(booking);
  const minutes = parseDurationMinutes(booking.duration);
  const where = bookingLocation(flat);

  return {
    summary: bookingSummary(flat),
    description: bookingDescription(flat),
    ...(where ? { location: where } : {}),
    start: {
      dateTime: `${booking.date}T${booking.time}:00`,
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: `${booking.date}T${addMinutesToTime(booking.time, minutes)}:00`,
      timeZone: TIMEZONE,
    },
  };
}

/** Every calendar that holds this booking, or should. */
async function targetsFor(booking: BookingRow): Promise<Target[]> {
  const db = getAdminClient().database;
  const targets: Target[] = [];

  if (booking.service_id) {
    const token = await getValidAccessToken(booking.service_id);
    if (token) {
      targets.push({
        label: `service:${booking.service_id}`,
        accessToken: token,
        eventId: booking.google_event_id,
        remember: async (eventId) => {
          await db
            .from("bookings")
            .update({ google_event_id: eventId })
            .eq("id", booking.id);
        },
        forget: async () => {
          await db
            .from("bookings")
            .update({ google_event_id: null })
            .eq("id", booking.id);
        },
      });
    }
  }

  const { data: mirrors } = await db
    .from("booking_calendar_mirrors")
    .select("owner_id, event_id")
    .eq("booking_id", booking.id);

  for (const mirror of (mirrors ?? []) as {
    owner_id: string;
    event_id: string;
  }[]) {
    const token = await getStaffAccessToken(mirror.owner_id);
    if (!token) continue;
    targets.push({
      label: `owner:${mirror.owner_id}`,
      accessToken: token,
      eventId: mirror.event_id,
      remember: async (eventId) => {
        await db
          .from("booking_calendar_mirrors")
          .update({ event_id: eventId })
          .eq("booking_id", booking.id)
          .eq("owner_id", mirror.owner_id);
      },
      forget: async () => {
        await db
          .from("booking_calendar_mirrors")
          .delete()
          .eq("booking_id", booking.id)
          .eq("owner_id", mirror.owner_id);
      },
    });
  }

  return targets;
}

async function loadBooking(bookingId: string): Promise<BookingRow | null> {
  const { data } = await getAdminClient()
    .database.from("bookings")
    .select(`${CALENDAR_BOOKING_FIELDS}, service_id, staff_id, google_event_id`)
    .eq("id", bookingId)
    .maybeSingle();

  return (data as BookingRow | null) ?? null;
}

/**
 * Rewrites the booking on every calendar that has it.
 *
 * A calendar that does not have it yet is left alone: putting it there is the
 * sync's job, and it runs every hour. This is for keeping copies honest, not
 * for making new ones.
 */
export async function updateBookingOnCalendars(
  bookingId: string,
): Promise<void> {
  try {
    const booking = await loadBooking(bookingId);
    if (!booking) return;

    const body = eventBody(booking);
    if (!body) return;

    const targets = await targetsFor(booking);

    await Promise.all(
      targets.map(async (target) => {
        if (!target.eventId) return;
        try {
          await updateCalendarEvent(
            target.accessToken,
            "primary",
            target.eventId,
            body,
          );
        } catch (err) {
          console.error(
            `[calendar] could not update ${target.label} for booking ${bookingId}:`,
            err,
          );
        }
      }),
    );
  } catch (err) {
    console.error("[calendar] update failed:", err);
  }
}

/**
 * Takes the booking off every calendar that has it.
 *
 * Used when a booking is cancelled or deleted, from wherever — the dashboard,
 * or the link at the bottom of the client's own email.
 */
export async function removeBookingFromCalendars(
  bookingId: string,
): Promise<void> {
  try {
    const booking = await loadBooking(bookingId);
    if (!booking) return;

    const targets = await targetsFor(booking);

    await Promise.all(
      targets.map(async (target) => {
        if (!target.eventId) return;
        try {
          await deleteCalendarEvent(
            target.accessToken,
            "primary",
            target.eventId,
          );
        } catch (err) {
          console.error(
            `[calendar] could not remove ${target.label} for booking ${bookingId}:`,
            err,
          );
        }
        // Forgotten either way: an event we cannot delete is one we will never
        // be able to delete, and remembering it only makes the next sync skip
        // a booking it should have re-created.
        await target.forget();
      }),
    );
  } catch (err) {
    console.error("[calendar] removal failed:", err);
  }
}
