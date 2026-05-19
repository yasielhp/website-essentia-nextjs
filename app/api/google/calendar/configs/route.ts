import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

/**
 * GET /api/google/calendar/configs
 *
 * Returns the Google Calendar connection status for all services.
 * Uses the service key server-side so token data is never exposed to the client.
 * The response deliberately omits token fields — only connection metadata is returned.
 */
export async function GET() {
  try {
    const adminClient = getAdminClient();

    const { data, error } = await adminClient.database
      .from("service_configs")
      .select("service_id, google_connected_email, google_calendar_id");

    if (error) {
      console.error("[google/calendar/configs] DB error:", error);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("[google/calendar/configs] error:", err);
    return NextResponse.json({ data: [] });
  }
}
