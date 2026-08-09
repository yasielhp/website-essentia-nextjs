import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  getStaffAccessToken,
  createCalendarEvent,
} from "@/lib/google-calendar";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";
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
 * POST /api/google/calendar/sync-user  { staff_id }
 *
 * Pushes to a person's calendar every future confirmed or paid booking of
 * theirs that has no event yet — the ones lost while the calendar was
 * disconnected, or that failed to sync when they were created.
 *
 * Staff may resync their own; admins may resync anyone's.
 */
export async function POST(request: NextRequest) {
  let caller;
  try {
    caller = await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  let body: { staff_id?: string };
  try {
    body = (await request.json()) as { staff_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const staffId = body.staff_id;
  if (!staffId) {
    return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
  }

  if (caller.role !== "admin" && caller.userId !== staffId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const accessToken = await getStaffAccessToken(staffId);
    if (!accessToken) {
      return NextResponse.json(
        { error: "No calendar connected for this person" },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().split("T")[0]!;
    const db = getAdminClient().database;

    const { data: bookings, error: bookingsErr } = await db
      .from("bookings")
      .select("id, service_title, first_name, last_name, date, time, duration")
      .eq("staff_id", staffId)
      .in("status", ["confirmed", "paid"])
      .gte("date", today)
      .is("google_event_id", null);

    if (bookingsErr) {
      console.error("[google/calendar/sync-user] bookings error:", bookingsErr);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 },
      );
    }

    const rows = (bookings ?? []) as Booking[];
    let synced = 0;
    let failed = 0;

    for (const booking of rows) {
      if (!booking.date || !booking.time) {
        failed++;
        continue;
      }

      const durationMinutes = parseDurationMinutes(booking.duration);
      const clientName =
        [booking.first_name, booking.last_name].filter(Boolean).join(" ") ||
        "Client";
      const summary = `${booking.service_title ?? "Essentia"} — ${clientName}`;

      try {
        const eventId = await createCalendarEvent(accessToken, "primary", {
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

        if (eventId) {
          await db
            .from("bookings")
            .update({ google_event_id: eventId })
            .eq("id", booking.id);
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ ok: true, synced, failed, total: rows.length });
  } catch (err) {
    console.error("[google/calendar/sync-user] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
