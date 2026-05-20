import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import {
  getValidAccessToken,
  createCalendarEvent,
} from "@/lib/google-calendar";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

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
 * POST /api/google/calendar/sync
 * Body: { service_id: string }
 *
 * Creates calendar events for all future confirmed/paid bookings of a service
 * that haven't been synced yet (google_event_id IS NULL).
 * Updates bookings.google_event_id after each successful creation.
 */
export async function POST(request: NextRequest) {
  let body: { service_id: string };
  try {
    body = (await request.json()) as { service_id: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { service_id } = body;
  if (!service_id) {
    return NextResponse.json({ error: "Missing service_id" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(service_id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "No calendar connected for this service" },
        { status: 400 },
      );
    }

    const adminClient = getAdminClient();

    const { data: config } = await adminClient.database
      .from("service_configs")
      .select("google_calendar_id")
      .eq("service_id", service_id)
      .single<{ google_calendar_id: string | null }>();

    const calendarId = config?.google_calendar_id ?? "primary";
    const today = new Date().toISOString().split("T")[0]!;

    const { data: bookings, error: bookingsErr } = await adminClient.database
      .from("bookings")
      .select("id, service_title, first_name, last_name, date, time, duration")
      .eq("service_id", service_id)
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
    let synced = 0;
    let failed = 0;

    for (const booking of rows) {
      if (!booking.date || !booking.time) {
        failed++;
        continue;
      }

      // Parse duration minutes from strings like "45 min" or "45"
      const durationMinutes = booking.duration
        ? parseInt(booking.duration.replace(/\D/g, ""), 10) || 60
        : 60;

      const clientName =
        [booking.first_name, booking.last_name].filter(Boolean).join(" ") ||
        "Client";

      const summary = `${booking.service_title ?? service_id} — ${clientName}`;

      const [startHour, startMinute] = booking.time.split(":").map(Number);
      const totalEnd =
        (startHour ?? 0) * 60 + (startMinute ?? 0) + durationMinutes;
      const endHour = Math.floor(totalEnd / 60)
        .toString()
        .padStart(2, "0");
      const endMinute = (totalEnd % 60).toString().padStart(2, "0");

      try {
        const eventId = await createCalendarEvent(accessToken, calendarId, {
          summary,
          start: {
            dateTime: `${booking.date}T${booking.time}:00`,
            timeZone: "Atlantic/Canary",
          },
          end: {
            dateTime: `${booking.date}T${endHour}:${endMinute}:00`,
            timeZone: "Atlantic/Canary",
          },
        });

        if (eventId) {
          await adminClient.database
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
    console.error("[google/calendar/sync] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
