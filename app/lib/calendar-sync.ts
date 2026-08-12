import { getAdminClient } from "@/lib/insforge-admin";
import {
  createCalendarEvent,
  getStaffAccessToken,
  getValidAccessToken,
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

/** Flattens the joined tier so the description can read one object. */
function withTier(booking: Booking): CalendarBooking {
  const tier = Array.isArray(booking.service_tiers)
    ? booking.service_tiers[0]
    : booking.service_tiers;
  return { ...booking, tier_label: tier?.label ?? null };
}

/** The row the calendar description reads, plus the tier it joins. */
type TierJoin = { label: string | null };

type Booking = CalendarBooking & {
  // The SDK types a join as an array; a single row still arrives as one.
  service_tiers?: TierJoin | TierJoin[] | null;
};

const BOOKING_FIELDS = CALENDAR_BOOKING_FIELDS;

/**
 * Pushes every booking that is missing from a calendar, everywhere at once.
 *
 * The per-service and per-person syncs already existed, but each had to be run
 * from its own screen, one at a time, and nothing told an administrator which
 * ones were behind. This walks every connected calendar — each member of staff
 * with one, and each service with one — and fills in what is missing.
 *
 * "Missing" is the honest definition: a confirmed or paid booking, in the
 * future, whose row carries no `google_event_id`. Bookings already on a
 * calendar are left alone, so running this twice costs nothing and changes
 * nothing.
 *
 * POST /api/google/calendar/sync-all
 */
async function syncBookings(
  accessToken: string,
  calendarId: string,
  bookings: Booking[],
  /** Set for a mirror: the event is recorded against this owner, not the row. */
  mirrorOwnerId?: string,
): Promise<{ synced: number; failed: number }> {
  const db = getAdminClient().database;

  // Each booking is independent, so they go to Google together. Each keeps its
  // own try/catch: one refusal must not throw away the tally for the rest.
  const outcomes = await Promise.all(
    bookings.map(async (booking) => {
      if (!booking.date || !booking.time) return false;

      const minutes = parseDurationMinutes(booking.duration);

      try {
        const eventId = await createCalendarEvent(accessToken, calendarId, {
          summary: bookingSummary(withTier(booking)),
          description: bookingDescription(withTier(booking)),
          ...(bookingLocation(withTier(booking))
            ? { location: bookingLocation(withTier(booking))! }
            : {}),
          start: {
            dateTime: `${booking.date}T${booking.time}:00`,
            timeZone: TIMEZONE,
          },
          end: {
            dateTime: `${booking.date}T${addMinutesToTime(booking.time, minutes)}:00`,
            timeZone: TIMEZONE,
          },
        });

        if (!eventId) return false;

        if (mirrorOwnerId) {
          // A mirror never touches `google_event_id`: that column belongs to
          // the professional's or the service's copy of this booking.
          await db.from("booking_calendar_mirrors").insert([
            {
              booking_id: booking.id,
              owner_id: mirrorOwnerId,
              event_id: eventId,
            },
          ]);
        } else {
          await db
            .from("bookings")
            .update({ google_event_id: eventId })
            .eq("id", booking.id);
        }
        return true;
      } catch {
        return false;
      }
    }),
  );

  const synced = outcomes.filter(Boolean).length;
  return { synced, failed: outcomes.length - synced };
}

/**
 * Puts one booking on every calendar that should hold it, now.
 *
 * The hourly job walks every calendar and fills in what is missing; this is the
 * same rules applied to a single booking, so one taken at four in the afternoon
 * is on the professional's phone at four in the afternoon rather than at a
 * quarter past five. The job stays exactly as it is — it is now the net that
 * catches whatever Google refused, not the way bookings normally arrive.
 *
 * SERVER ONLY. Never throws, and safe to call twice: a calendar that already
 * holds the booking is skipped, so a second call finds nothing to do.
 */
export async function pushBookingToCalendars(bookingId: string): Promise<void> {
  if (!bookingId) return;

  try {
    const db = getAdminClient().database;

    const { data } = await db
      .from("bookings")
      .select(`${BOOKING_FIELDS}, service_id, staff_id, google_event_id`)
      .eq("id", bookingId)
      .maybeSingle();

    const booking = data as
      | (Booking & {
          service_id: string | null;
          staff_id: string | null;
          google_event_id: string | null;
        })
      | null;
    if (!booking) return;

    // The same two conditions the hourly job applies, for the same reasons: a
    // draft is not a session anybody has to be there for, and a calendar gains
    // nothing from an appointment that has already happened.
    const today = new Date().toISOString().split("T")[0]!;
    const isLive = booking.status === "confirmed" || booking.status === "paid";
    if (!isLive || !booking.date || booking.date < today) return;

    // An administrator holds a mirror of the whole centre rather than a diary
    // of their own sessions, so one who also happens to be assigned to this
    // booking must be served as a mirror and not twice.
    const { data: adminRows } = await db
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    const admins = ((adminRows ?? []) as { id: string }[]).map((row) => row.id);

    // The professional's calendar, or the service's when there is no
    // professional with one: both record the event in `google_event_id`, so
    // only one of them may write it.
    if (!booking.google_event_id) {
      let token: string | null = null;
      if (booking.staff_id && !admins.includes(booking.staff_id)) {
        token = await getStaffAccessToken(booking.staff_id);
      }
      if (!token && booking.service_id) {
        token = await getValidAccessToken(booking.service_id);
      }
      if (token) await syncBookings(token, "primary", [booking]);
    }

    const { data: mirrorRows } = await db
      .from("booking_calendar_mirrors")
      .select("owner_id")
      .eq("booking_id", booking.id);

    const mirrored = new Set(
      ((mirrorRows ?? []) as { owner_id: string }[]).map((row) => row.owner_id),
    );

    await Promise.all(
      admins
        .filter((id) => !mirrored.has(id))
        .map(async (id) => {
          const token = await getStaffAccessToken(id);
          if (!token) return;
          await syncBookings(token, "primary", [booking], id);
        }),
    );
  } catch (err) {
    // The booking is already saved, and whoever took it cannot fix Google from
    // where they are standing. The hourly job will try again.
    console.error("[calendar] push failed:", err);
  }
}

export type CalendarSyncReport = {
  target: string;
  kind: "staff" | "admin" | "service";
  synced: number;
  failed: number;
  skipped?: string;
};

/**
 * Puts every booking that is missing from a calendar on it.
 *
 * Called by the button in Settings and by the hourly job, which is why it lives
 * here rather than inside either of them.
 */
export async function syncAllCalendars(): Promise<{
  calendars: number;
  synced: number;
  failed: number;
  report: CalendarSyncReport[];
}> {
  const db = getAdminClient().database;
  const today = new Date().toISOString().split("T")[0]!;

  const [{ data: staffRows }, { data: serviceRows }] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, first_name, role")
      .not("google_refresh_token", "is", null),
    db
      .from("service_configs")
      .select("service_id")
      .not("google_refresh_token", "is", null),
  ]);

  const people = (staffRows ?? []) as {
    id: string;
    full_name: string | null;
    first_name: string | null;
    role: string | null;
  }[];
  const services = (serviceRows ?? []) as { service_id: string }[];

  const report: {
    target: string;
    kind: "staff" | "admin" | "service";
    synced: number;
    failed: number;
    skipped?: string;
  }[] = [];

  // Every calendar is somebody else's, so they are worked at the same time.
  //
  // The one thing that looked like a shared resource is not: refreshing a
  // token asks Google for a new access token and leaves the refresh token
  // alone, and Google keeps previously issued access tokens valid. Two rows
  // that happen to belong to the same Google account can each refresh and each
  // store its own, whatever order they finish in.
  const personReports = people.map(async (person) => {
    const label = person.full_name ?? person.first_name ?? person.id;
    const kind: "staff" | "admin" = person.role === "admin" ? "admin" : "staff";

    const accessToken = await getStaffAccessToken(person.id);
    if (!accessToken) {
      return {
        target: label,
        kind,
        synced: 0,
        failed: 0,
        skipped: "no valid token",
      };
    }

    // An admin's calendar mirrors the whole centre; a member of staff's holds
    // the sessions they perform. Nothing an admin has on their own calendar
    // narrows availability either — the booking flow reads staff schedules and
    // `staff_services` calendars, and an admin is in neither.
    const isAdmin = person.role === "admin";
    let pending: Booking[];

    if (isAdmin) {
      // Everything the centre has ahead of it, minus what this calendar was
      // already given. `google_event_id` says nothing here: a booking already
      // on the professional's calendar still has to reach the administrator's.
      const [{ data: all }, { data: mirrored }] = await Promise.all([
        db
          .from("bookings")
          .select(BOOKING_FIELDS)
          .in("status", ["confirmed", "paid"])
          .gte("date", today),
        db
          .from("booking_calendar_mirrors")
          .select("booking_id")
          .eq("owner_id", person.id),
      ]);

      const already = new Set(
        ((mirrored ?? []) as { booking_id: string }[]).map(
          (row) => row.booking_id,
        ),
      );
      pending = ((all ?? []) as Booking[]).filter(
        (booking) => !already.has(booking.id),
      );
    } else {
      const { data } = await db
        .from("bookings")
        .select(BOOKING_FIELDS)
        .eq("staff_id", person.id)
        .in("status", ["confirmed", "paid"])
        .gte("date", today)
        .is("google_event_id", null);
      pending = (data ?? []) as Booking[];
    }

    const result = await syncBookings(
      accessToken,
      "primary",
      pending,
      isAdmin ? person.id : undefined,
    );
    return { target: label, kind, ...result };
  });

  // A booking whose professional has a calendar is theirs to hold. Both syncs
  // record the event in the same `google_event_id`, so letting the service
  // create one as well leaves a second event on a second calendar that nothing
  // will ever move or delete — and they run at the same time, so which of the
  // two ids survives is a coin toss.
  const staffWithCalendar = new Set(
    people.filter((person) => person.role !== "admin").map((p) => p.id),
  );

  const serviceReports = services.map(async (service) => {
    const accessToken = await getValidAccessToken(service.service_id);
    if (!accessToken) {
      return {
        target: service.service_id,
        kind: "service" as const,
        synced: 0,
        failed: 0,
        skipped: "no valid token",
      };
    }

    const { data } = await db
      .from("bookings")
      .select(`${BOOKING_FIELDS}, staff_id`)
      .eq("service_id", service.service_id)
      .in("status", ["confirmed", "paid"])
      .gte("date", today)
      .is("google_event_id", null);

    const pending = (
      (data ?? []) as (Booking & { staff_id?: string | null })[]
    ).filter(
      (booking) =>
        !booking.staff_id || !staffWithCalendar.has(booking.staff_id),
    );

    const result = await syncBookings(accessToken, "primary", pending);
    return { target: service.service_id, kind: "service" as const, ...result };
  });

  report.push(...(await Promise.all([...personReports, ...serviceReports])));

  return {
    calendars: report.length,
    synced: report.reduce((total, row) => total + row.synced, 0),
    failed: report.reduce((total, row) => total + row.failed, 0),
    report,
  };
}
