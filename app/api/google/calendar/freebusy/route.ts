import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import {
  getValidAccessToken,
  getStaffServiceAccessToken,
  getFreeBusy,
} from "@/lib/google-calendar";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");
  const date = searchParams.get("date"); // single day "YYYY-MM-DD"
  const start = searchParams.get("start"); // range start "YYYY-MM-DD"
  const end = searchParams.get("end"); // range end   "YYYY-MM-DD"

  if (!serviceId || (!date && (!start || !end))) {
    return NextResponse.json(
      { error: "Missing service_id or date / start+end" },
      { status: 400 },
    );
  }

  const queryDate = date ?? start!;
  const timeMax = date ? `${date}T23:59:59Z` : `${end}T23:59:59Z`;

  try {
    const adminClient = getAdminClient();
    const allBusy: { start: string; end: string }[] = [];
    let hasCalendar = false;

    // 1. Service-level calendar (configured in Settings — primary source of events)
    const serviceToken = await getValidAccessToken(serviceId);
    if (serviceToken) {
      hasCalendar = true;
      const busy = await getFreeBusy(
        serviceToken,
        "primary",
        queryDate,
        timeMax,
      );
      allBusy.push(...busy);
    }

    // 2. Staff-level calendars (staff assigned to this service)
    const { data: staffRows } = await adminClient.database
      .from("staff_services")
      .select("staff_id, google_access_token")
      .eq("service_id", serviceId)
      .not("google_access_token", "is", null);

    const assignedStaff = (
      (staffRows ?? []) as {
        staff_id: string;
        google_access_token: string | null;
      }[]
    ).filter((r) => !!r.google_access_token);

    if (assignedStaff.length > 0) {
      hasCalendar = true;
      await Promise.all(
        assignedStaff.map(async ({ staff_id }) => {
          const token = await getStaffServiceAccessToken(staff_id, serviceId);
          if (!token) return;
          const busy = await getFreeBusy(token, "primary", queryDate, timeMax);
          allBusy.push(...busy);
        }),
      );
    }

    // 3. Fallback: if this service has no calendar of its own, use any service
    //    that has one — in a single-practitioner centre all slots are shared.
    if (!hasCalendar) {
      const { data: allConfigs } = await adminClient.database
        .from("service_configs")
        .select("service_id")
        .not("google_access_token", "is", null)
        .neq("service_id", serviceId)
        .limit(5);

      await Promise.all(
        ((allConfigs ?? []) as { service_id: string }[]).map(
          async ({ service_id }) => {
            const token = await getValidAccessToken(service_id);
            if (!token) return;
            const busy = await getFreeBusy(
              token,
              "primary",
              queryDate,
              timeMax,
            );
            allBusy.push(...busy);
          },
        ),
      );
    }

    return NextResponse.json({ busy: allBusy });
  } catch (err) {
    console.error("[google/calendar/freebusy] error:", err);
    // Fail-open: return empty so the booking flow is not blocked
    return NextResponse.json({ busy: [] });
  }
}
