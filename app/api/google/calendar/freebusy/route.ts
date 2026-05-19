import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getValidAccessToken, getFreeBusy } from "@/lib/google-calendar";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");
  const date = searchParams.get("date"); // "YYYY-MM-DD"

  if (!serviceId || !date) {
    return NextResponse.json(
      { error: "Missing service_id or date" },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(serviceId);

    // No calendar connected — all slots available (fail-open)
    if (!accessToken) {
      return NextResponse.json({ busy: [] });
    }

    const adminClient = getAdminClient();
    const { data: config } = await adminClient.database
      .from("service_configs")
      .select("google_calendar_id")
      .eq("service_id", serviceId)
      .single<{ google_calendar_id: string | null }>();

    const calendarId = config?.google_calendar_id ?? "primary";

    const busy = await getFreeBusy(accessToken, calendarId, date);
    return NextResponse.json({ busy });
  } catch (err) {
    // Fail-open: return empty busy list so the booking flow is not broken
    console.error("[google/calendar/freebusy] error:", err);
    return NextResponse.json({ busy: [] });
  }
}
