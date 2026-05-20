import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getStaffServiceAccessToken, getFreeBusy } from "@/lib/google-calendar";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");
  const date = searchParams.get("date"); // "YYYY-MM-DD" in local time

  if (!serviceId || !date) {
    return NextResponse.json(
      { error: "Missing service_id or date" },
      { status: 400 },
    );
  }

  try {
    const adminClient = getAdminClient();

    // Get all staff assigned to this service that have a connected calendar
    const { data: staffRows } = await adminClient.database
      .from("staff_services")
      .select("staff_id, google_access_token")
      .eq("service_id", serviceId)
      .not("google_access_token", "is", null);

    const assignedStaff = ((staffRows ?? []) as { staff_id: string; google_access_token: string | null }[])
      .filter((r) => !!r.google_access_token);

    if (assignedStaff.length === 0) {
      // No calendar connected for any staff on this service — all slots available
      return NextResponse.json({ busy: [] });
    }

    // Query freebusy for each staff member and merge results
    const allBusy: { start: string; end: string }[] = [];

    await Promise.all(
      assignedStaff.map(async ({ staff_id }) => {
        const accessToken = await getStaffServiceAccessToken(staff_id, serviceId);
        if (!accessToken) return;

        const busy = await getFreeBusy(accessToken, "primary", date);
        allBusy.push(...busy);
      }),
    );

    return NextResponse.json({ busy: allBusy });
  } catch (err) {
    console.error("[google/calendar/freebusy] error:", err);
    // Fail-open: return empty busy list so the booking flow is not broken
    return NextResponse.json({ busy: [] });
  }
}
