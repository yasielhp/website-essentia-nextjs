import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_ROLES,
  requireApiRole,
  toAuthErrorResponse,
} from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  createCalendarEvent,
  getStaffAccessToken,
  getValidAccessToken,
} from "@/lib/google-calendar";
import { addMinutesToTime, parseDurationMinutes } from "@/utils/format";

const TIMEZONE = "Atlantic/Canary";

type Booking = {
  id: string;
  service_title: string | null;
  first_name: string | null;
  last_name: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
};

const BOOKING_FIELDS =
  "id, service_title, first_name, last_name, date, time, duration";

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
): Promise<{ synced: number; failed: number }> {
  const db = getAdminClient().database;

  // Each booking is independent, so they go to Google together. Each keeps its
  // own try/catch: one refusal must not throw away the tally for the rest.
  const outcomes = await Promise.all(
    bookings.map(async (booking) => {
      if (!booking.date || !booking.time) return false;

      const minutes = parseDurationMinutes(booking.duration);
      const clientName =
        [booking.first_name, booking.last_name].filter(Boolean).join(" ") ||
        "Client";

      try {
        const eventId = await createCalendarEvent(accessToken, calendarId, {
          summary: `${booking.service_title ?? "Essentia"} — ${clientName}`,
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

        await db
          .from("bookings")
          .update({ google_event_id: eventId })
          .eq("id", booking.id);
        return true;
      } catch {
        return false;
      }
    }),
  );

  const synced = outcomes.filter(Boolean).length;
  return { synced, failed: outcomes.length - synced };
}

export async function POST(request: NextRequest) {
  try {
    await requireApiRole(request, ADMIN_ROLES);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const db = getAdminClient().database;
  const today = new Date().toISOString().split("T")[0]!;

  const [{ data: staffRows }, { data: serviceRows }] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, first_name")
      .not("google_refresh_token", "is", null),
    db
      .from("service_configs")
      .select("service_id")
      .not("google_refresh_token", "is", null),
  ]);

  const staff = (staffRows ?? []) as {
    id: string;
    full_name: string | null;
    first_name: string | null;
  }[];
  const services = (serviceRows ?? []) as { service_id: string }[];

  const report: {
    target: string;
    kind: "staff" | "service";
    synced: number;
    failed: number;
    skipped?: string;
  }[] = [];

  // Sequential across calendars on purpose: a token refresh writes back to the
  // row it came from, and two calendars belonging to the same account would
  // otherwise race to store their own refreshed token.
  for (const person of staff) {
    const label = person.full_name ?? person.first_name ?? person.id;
    const accessToken = await getStaffAccessToken(person.id);
    if (!accessToken) {
      report.push({
        target: label,
        kind: "staff",
        synced: 0,
        failed: 0,
        skipped: "no valid token",
      });
      continue;
    }

    const { data } = await db
      .from("bookings")
      .select(BOOKING_FIELDS)
      .eq("staff_id", person.id)
      .in("status", ["confirmed", "paid"])
      .gte("date", today)
      .is("google_event_id", null);

    const result = await syncBookings(
      accessToken,
      "primary",
      (data ?? []) as Booking[],
    );
    report.push({ target: label, kind: "staff", ...result });
  }

  for (const service of services) {
    const accessToken = await getValidAccessToken(service.service_id);
    if (!accessToken) {
      report.push({
        target: service.service_id,
        kind: "service",
        synced: 0,
        failed: 0,
        skipped: "no valid token",
      });
      continue;
    }

    const { data } = await db
      .from("bookings")
      .select(BOOKING_FIELDS)
      .eq("service_id", service.service_id)
      .in("status", ["confirmed", "paid"])
      .gte("date", today)
      .is("google_event_id", null);

    const result = await syncBookings(
      accessToken,
      "primary",
      (data ?? []) as Booking[],
    );
    report.push({ target: service.service_id, kind: "service", ...result });
  }

  return NextResponse.json({
    ok: true,
    calendars: report.length,
    synced: report.reduce((total, row) => total + row.synced, 0),
    failed: report.reduce((total, row) => total + row.failed, 0),
    report,
  });
}
