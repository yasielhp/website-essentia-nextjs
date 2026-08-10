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

    // Whose diary is this? A member of staff's calendar holds the sessions they
    // perform, so `staff_id` is the filter. An administrator's mirrors the
    // whole centre — filtering by `staff_id` there asks for the sessions an
    // administrator performs, which is none of them, and the resync reported
    // nothing to do while the month was full of bookings.
    const { data: targetProfile } = await db
      .from("profiles")
      .select("role")
      .eq("id", staffId)
      .maybeSingle();

    const isAdmin =
      (targetProfile as { role?: string } | null)?.role === "admin";

    let bookings: Booking[] | null = null;
    let bookingsErr: unknown = null;

    if (isAdmin) {
      const [all, mirrored] = await Promise.all([
        db
          .from("bookings")
          .select(
            "id, service_title, first_name, last_name, date, time, duration",
          )
          .in("status", ["confirmed", "paid"])
          .gte("date", today),
        db
          .from("booking_calendar_mirrors")
          .select("booking_id")
          .eq("owner_id", staffId),
      ]);

      bookingsErr = all.error;
      const already = new Set(
        ((mirrored.data ?? []) as { booking_id: string }[]).map(
          (row) => row.booking_id,
        ),
      );
      bookings = ((all.data ?? []) as Booking[]).filter(
        (booking) => !already.has(booking.id),
      );
    } else {
      const result = await db
        .from("bookings")
        .select(
          "id, service_title, first_name, last_name, date, time, duration",
        )
        .eq("staff_id", staffId)
        .in("status", ["confirmed", "paid"])
        .gte("date", today)
        .is("google_event_id", null);

      bookings = (result.data ?? []) as Booking[];
      bookingsErr = result.error;
    }

    if (bookingsErr) {
      console.error("[google/calendar/sync-user] bookings error:", bookingsErr);
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
    console.error("[google/calendar/sync-user] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
