import { NextRequest, NextResponse } from "next/server";
import {
  getValidAccessToken,
  getStaffServiceAccessToken,
} from "@/lib/google-calendar";
import { listStaffWithCalendar } from "@/services/calendar-config.service";

/**
 * GET /api/google/calendar/has-calendar?service_id=…
 *
 * Whether a service has any calendar connected. Intentionally public — the
 * booking flow needs it for anonymous visitors — and returns a single boolean,
 * never an account address or token.
 */
export async function GET(request: NextRequest) {
  const serviceId = new URL(request.url).searchParams.get("service_id");
  if (!serviceId) {
    return NextResponse.json({ hasCalendar: false });
  }

  try {
    if (await getValidAccessToken(serviceId)) {
      return NextResponse.json({ hasCalendar: true });
    }

    const staffIds = await listStaffWithCalendar(serviceId);
    for (const staffId of staffIds) {
      if (await getStaffServiceAccessToken(staffId, serviceId)) {
        return NextResponse.json({ hasCalendar: true });
      }
    }

    return NextResponse.json({ hasCalendar: false });
  } catch {
    return NextResponse.json({ hasCalendar: false });
  }
}
