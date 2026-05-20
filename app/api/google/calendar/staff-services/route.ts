import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/google/calendar/staff-services?staff_id=UUID
 *
 * Returns the list of services assigned to a staff member
 * (joined with service_settings to get the title).
 *
 * Response: { services: { id: string; title: string }[] }
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
      .select("service_id, service_settings(id, title)")
      .eq("staff_id", staffId);

    if (error) {
      console.error("[google/calendar/staff-services] db error:", error);
      return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
    }

    const services = ((data ?? []) as { service_id: string; service_settings: { id: string; title: string } | null }[])
      .filter((r) => r.service_settings)
      .map((r) => ({ id: r.service_settings!.id, title: r.service_settings!.title }));

    return NextResponse.json({ services });
  } catch (err) {
    console.error("[google/calendar/staff-services] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
