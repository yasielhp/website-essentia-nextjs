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

type EventRequestBody = {
  service_id: string;
  summary: string;
  description?: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  duration_minutes: number;
  timezone?: string;
};

export async function POST(request: NextRequest) {
  let body: EventRequestBody;

  try {
    body = (await request.json()) as EventRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    service_id,
    summary,
    description,
    date,
    time,
    duration_minutes,
    timezone = "Europe/Madrid",
  } = body;

  if (!service_id || !summary || !date || !time || !duration_minutes) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(service_id);

    // No calendar connected — succeed silently
    if (!accessToken) {
      return NextResponse.json({ ok: true });
    }

    const adminClient = getAdminClient();
    const { data: config } = await adminClient.database
      .from("service_configs")
      .select("google_calendar_id")
      .eq("service_id", service_id)
      .single<{ google_calendar_id: string | null }>();

    const calendarId = config?.google_calendar_id ?? "primary";

    // Build ISO 8601 datetimes for the event
    // e.g. date="2026-05-20", time="10:00" → "2026-05-20T10:00:00"
    const startDateTime = `${date}T${time}:00`;
    const [startHour, startMinute] = time.split(":").map(Number);
    const totalStartMinutes = startHour * 60 + startMinute + duration_minutes;
    const endHour = Math.floor(totalStartMinutes / 60)
      .toString()
      .padStart(2, "0");
    const endMinute = (totalStartMinutes % 60).toString().padStart(2, "0");
    const endDateTime = `${date}T${endHour}:${endMinute}:00`;

    const eventId = await createCalendarEvent(accessToken, calendarId, {
      summary,
      description,
      start: { dateTime: startDateTime, timeZone: timezone },
      end: { dateTime: endDateTime, timeZone: timezone },
    });

    return NextResponse.json({ ok: true, eventId });
  } catch (err) {
    // Fail-open: calendar sync failure must not break the booking
    console.error("[google/calendar/event] error:", err);
    return NextResponse.json({ ok: true });
  }
}
