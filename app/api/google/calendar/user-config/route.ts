import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/google/calendar/user-config?staff_id=UUID
 *
 * Returns all staff_services rows for a staff member with their
 * Google Calendar connection status (google_calendar_email per service).
 *
 * Response: { configs: { service_id: string; google_calendar_email: string | null }[] }
 */

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staff_id");

  if (!staffId) {
    return NextResponse.json(
      { error: "staff_id query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const adminClient = getAdminClient();

    const { data, error } = await adminClient.database
      .from("staff_services")
      .select("service_id, google_calendar_email")
      .eq("staff_id", staffId);

    if (error) {
      console.error("[google/calendar/user-config] db error:", error);
      return NextResponse.json(
        { error: "Failed to fetch configs" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      configs: (data ?? []) as {
        service_id: string;
        google_calendar_email: string | null;
      }[],
    });
  } catch (err) {
    console.error("[google/calendar/user-config] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
