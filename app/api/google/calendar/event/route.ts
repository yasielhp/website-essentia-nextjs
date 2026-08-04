import { NextRequest, NextResponse } from "next/server";
import {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";
import { getServiceCalendarId } from "@/services/calendar-config.service";
import { addMinutesToTime } from "@/utils/format";

/**
 * Google Calendar event CRUD for the dashboard. Staff only — these handlers
 * write to the centre's real calendar, and were previously unauthenticated.
 *
 * Calendar failures are swallowed on purpose: a booking must never fail because
 * the calendar is unreachable. Authorisation failures are *not* swallowed.
 */

const DEFAULT_TIMEZONE = "Atlantic/Canary";

type EventRequestBody = {
  service_id: string;
  summary: string;
  description?: string;
  location?: string;
  colorId?: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  duration_minutes: number;
  timezone?: string;
};

type UpdateRequestBody = EventRequestBody & { event_id: string };
type DeleteRequestBody = { service_id: string; event_id: string };

/** Builds the Google `start`/`end` pair from a date, time and duration. */
function buildEventWindow(body: EventRequestBody) {
  const timezone = body.timezone ?? DEFAULT_TIMEZONE;
  return {
    start: { dateTime: `${body.date}T${body.time}:00`, timeZone: timezone },
    end: {
      dateTime: `${body.date}T${addMinutesToTime(body.time, body.duration_minutes)}:00`,
      timeZone: timezone,
    },
  };
}

function buildEventPayload(body: EventRequestBody) {
  return {
    summary: body.summary,
    description: body.description,
    ...(body.location ? { location: body.location } : {}),
    ...(body.colorId ? { colorId: body.colorId } : {}),
    ...buildEventWindow(body),
  };
}

async function readJson<T>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function hasEventFields(body: EventRequestBody): boolean {
  return Boolean(
    body.service_id &&
    body.summary &&
    body.date &&
    body.time &&
    body.duration_minutes,
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const body = await readJson<EventRequestBody>(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!hasEventFields(body)) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(body.service_id);
    if (!accessToken) return NextResponse.json({ ok: true });

    const calendarId = await getServiceCalendarId(body.service_id);
    const eventId = await createCalendarEvent(
      accessToken,
      calendarId,
      buildEventPayload(body),
    );

    return NextResponse.json({ ok: true, eventId });
  } catch (err) {
    console.error("[google/calendar/event POST] error:", err);
    return NextResponse.json({ ok: true });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const body = await readJson<UpdateRequestBody>(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!hasEventFields(body) || !body.event_id) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(body.service_id);
    if (!accessToken) return NextResponse.json({ ok: true });

    const calendarId = await getServiceCalendarId(body.service_id);
    await updateCalendarEvent(
      accessToken,
      calendarId,
      body.event_id,
      buildEventPayload(body),
    );

    return NextResponse.json({ ok: true, eventId: body.event_id });
  } catch (err) {
    console.error("[google/calendar/event PATCH] error:", err);
    return NextResponse.json({ ok: true });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const body = await readJson<DeleteRequestBody>(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.service_id || !body.event_id) {
    return NextResponse.json(
      { error: "Missing service_id or event_id" },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(body.service_id);
    if (!accessToken) return NextResponse.json({ ok: true });

    const calendarId = await getServiceCalendarId(body.service_id);
    await deleteCalendarEvent(accessToken, calendarId, body.event_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[google/calendar/event DELETE] error:", err);
    return NextResponse.json({ ok: true });
  }
}
