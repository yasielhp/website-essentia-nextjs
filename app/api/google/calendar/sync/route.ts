import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  getValidAccessToken,
  createCalendarEvent,
} from "@/lib/google-calendar";
import {
  ADMIN_ROLES,
  requireApiRole,
  toAuthErrorResponse,
} from "@/lib/auth-guard";
import { getServiceCalendarId } from "@/services/calendar-config.service";
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

/**
 * POST /api/google/calendar/sync  { service_id }
 *
 * Back-fills calendar events for every future confirmed or paid booking of a
 * service that has not been synced yet. Admin only: it reads client data in
 * bulk and writes to the real calendar.
 */
export async function POST(request: NextRequest) {
  try {
    await requireApiRole(request, ADMIN_ROLES);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  let body: { service_id?: string };
  try {
    body = (await request.json()) as { service_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const serviceId = body.service_id;
  if (!serviceId) {
    return NextResponse.json({ error: "Missing service_id" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(serviceId);
    if (!accessToken) {
      return NextResponse.json(
        { error: "No calendar connected for this service" },
        { status: 400 },
      );
    }

    const calendarId = await getServiceCalendarId(serviceId);
    const today = new Date().toISOString().split("T")[0]!;
    const db = getAdminClient().database;

    const { data: bookings, error: bookingsErr } = await db
      .from("bookings")
      .select("id, service_title, first_name, last_name, date, time, duration")
      .eq("service_id", serviceId)
      .in("status", ["confirmed", "paid"])
      .gte("date", today)
      .is("google_event_id", null);

    if (bookingsErr) {
      console.error("[google/calendar/sync] bookings error:", bookingsErr);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 },
      );
    }

    const rows = (bookings ?? []) as Booking[];
    // One booking says nothing about the next, so they go to Google together
    // rather than one round trip at a time. Each keeps its own try/catch, so a
    // booking that fails is counted and the rest still sync — `Promise.all`
    // rejecting on the first error would have thrown the tally away.
    const outcomes = await Promise.all(
      rows.map(async (booking) => {
        if (!booking.date || !booking.time) return false;

        const durationMinutes = parseDurationMinutes(booking.duration);
        const clientName =
          [booking.first_name, booking.last_name].filter(Boolean).join(" ") ||
          "Client";
        const summary = `${booking.service_title ?? serviceId} — ${clientName}`;

        try {
          const eventId = await createCalendarEvent(accessToken, calendarId, {
            summary,
            start: {
              dateTime: `${booking.date}T${booking.time}:00`,
              timeZone: TIMEZONE,
            },
            end: {
              dateTime: `${booking.date}T${addMinutesToTime(booking.time, durationMinutes)}:00`,
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
    const failed = outcomes.length - synced;

    return NextResponse.json({ ok: true, synced, failed, total: rows.length });
  } catch (err) {
    console.error("[google/calendar/sync] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
