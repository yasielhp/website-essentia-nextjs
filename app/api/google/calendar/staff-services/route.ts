import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/google/calendar/staff-services?staff_id=UUID
 *
 * Returns the list of services assigned to a staff member with their titles.
 * Uses two separate queries instead of a join to avoid PostgREST FK requirements.
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

    // 1. Get service IDs assigned to this staff member
    const { data: assignedData, error: assignedError } =
      await adminClient.database
        .from("staff_services")
        .select("service_id")
        .eq("staff_id", staffId);

    if (assignedError) {
      console.error(
        "[google/calendar/staff-services] staff_services error:",
        assignedError,
      );
      return NextResponse.json(
        { error: "Failed to fetch assignments" },
        { status: 500 },
      );
    }

    const serviceIds = ((assignedData ?? []) as { service_id: string }[]).map(
      (r) => r.service_id,
    );

    if (serviceIds.length === 0) {
      return NextResponse.json({ services: [] });
    }

    // 2. Get service titles
    const { data: svcData, error: svcError } = await adminClient.database
      .from("service_settings")
      .select("id, title")
      .in("id", serviceIds);

    if (svcError) {
      console.error(
        "[google/calendar/staff-services] service_settings error:",
        svcError,
      );
      return NextResponse.json(
        { error: "Failed to fetch service titles" },
        { status: 500 },
      );
    }

    const services = ((svcData ?? []) as { id: string; title: string }[]).map(
      (s) => ({ id: s.id, title: s.title }),
    );

    return NextResponse.json({ services });
  } catch (err) {
    console.error("[google/calendar/staff-services] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
