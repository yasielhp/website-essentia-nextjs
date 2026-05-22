import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import {
  getValidAccessToken,
  getStaffServiceAccessToken,
} from "@/lib/google-calendar";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function GET(request: NextRequest) {
  const serviceId = new URL(request.url).searchParams.get("service_id");
  if (!serviceId) {
    return NextResponse.json({ hasCalendar: false });
  }

  try {
    // 1. Service-level calendar
    const serviceToken = await getValidAccessToken(serviceId);
    if (serviceToken) return NextResponse.json({ hasCalendar: true });

    // 2. Staff-level calendars
    const adminClient = getAdminClient();
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

    for (const { staff_id } of assignedStaff) {
      const token = await getStaffServiceAccessToken(staff_id, serviceId);
      if (token) return NextResponse.json({ hasCalendar: true });
    }

    return NextResponse.json({ hasCalendar: false });
  } catch {
    return NextResponse.json({ hasCalendar: false });
  }
}
