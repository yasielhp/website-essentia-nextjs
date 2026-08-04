import { NextRequest, NextResponse } from "next/server";
import {
  getValidAccessToken,
  getStaffServiceAccessToken,
  getFreeBusy,
} from "@/lib/google-calendar";
import {
  listOtherConnectedServices,
  listStaffWithCalendar,
} from "@/services/calendar-config.service";

/**
 * GET /api/google/calendar/freebusy?service_id=…&date=YYYY-MM-DD
 * GET /api/google/calendar/freebusy?service_id=…&start=…&end=…
 *
 * Busy intervals for a service. Intentionally public: the booking flow calls it
 * for anonymous visitors. It returns only opaque start/end pairs — no titles,
 * attendees or account addresses — and the date inputs are format-checked so
 * the range cannot be widened arbitrarily.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!serviceId || (!date && (!start || !end))) {
    return NextResponse.json(
      { error: "Missing service_id or date / start+end" },
      { status: 400 },
    );
  }

  const from = date ?? start!;
  const to = date ?? end!;
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json(
      { error: "Dates must be in YYYY-MM-DD format" },
      { status: 400 },
    );
  }

  const timeMax = `${to}T23:59:59Z`;

  try {
    const busyGroups: { start: string; end: string }[][] = [];
    let hasCalendar = false;

    // 1. Service-level calendar — the primary source of events.
    const serviceToken = await getValidAccessToken(serviceId);
    if (serviceToken) {
      hasCalendar = true;
      busyGroups.push(
        await getFreeBusy(serviceToken, "primary", from, timeMax),
      );
    }

    // 2. Calendars of staff assigned to this service.
    const staffIds = await listStaffWithCalendar(serviceId);
    if (staffIds.length > 0) {
      hasCalendar = true;
      const results = await Promise.all(
        staffIds.map(async (staffId) => {
          const token = await getStaffServiceAccessToken(staffId, serviceId);
          if (!token) return [];
          return getFreeBusy(token, "primary", from, timeMax);
        }),
      );
      busyGroups.push(...results);
    }

    // 3. Fallback: in a single-practitioner centre every slot is shared, so a
    //    service with no calendar of its own borrows another's availability.
    if (!hasCalendar) {
      const otherServiceIds = await listOtherConnectedServices(serviceId);
      const results = await Promise.all(
        otherServiceIds.map(async (id) => {
          const token = await getValidAccessToken(id);
          if (!token) return [];
          return getFreeBusy(token, "primary", from, timeMax);
        }),
      );
      busyGroups.push(...results);
    }

    return NextResponse.json({ busy: busyGroups.flat() });
  } catch (err) {
    console.error("[google/calendar/freebusy] error:", err);
    // Fail-open: an unavailable calendar must not block the booking flow.
    return NextResponse.json({ busy: [] });
  }
}
