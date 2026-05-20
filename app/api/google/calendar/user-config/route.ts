import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/google/calendar/user-config?staff_id=UUID
 *
 * Returns the shared Google Calendar connection status for each service
 * assigned to the staff member. Reads from service_configs (single source
 * of truth shared between admin and staff).
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

    // 1. Get service IDs assigned to this staff member
    const { data: assignments, error: assignErr } = await adminClient.database
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", staffId);

    if (assignErr) {
      console.error(
        "[google/calendar/user-config] assignments error:",
        assignErr,
      );
      return NextResponse.json(
        { error: "Failed to fetch assignments" },
        { status: 500 },
      );
    }

    const serviceIds = ((assignments ?? []) as { service_id: string }[]).map(
      (r) => r.service_id,
    );

    if (serviceIds.length === 0) {
      return NextResponse.json({ configs: [] });
    }

    // 2. Read shared calendar connection from service_configs
    const { data: configs, error: configErr } = await adminClient.database
      .from("service_configs")
      .select("service_id, google_connected_email")
      .in("service_id", serviceIds);

    if (configErr) {
      console.error("[google/calendar/user-config] configs error:", configErr);
      return NextResponse.json(
        { error: "Failed to fetch configs" },
        { status: 500 },
      );
    }

    const configMap: Record<string, string | null> = {};
    for (const row of (configs ?? []) as {
      service_id: string;
      google_connected_email: string | null;
    }[]) {
      configMap[row.service_id] = row.google_connected_email;
    }

    const result = serviceIds.map((id) => ({
      service_id: id,
      google_calendar_email: configMap[id] ?? null,
    }));

    return NextResponse.json({ configs: result });
  } catch (err) {
    console.error("[google/calendar/user-config] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
