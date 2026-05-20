import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * DELETE /api/google/calendar/disconnect-user?staff_id=UUID&service_id=UUID
 *
 * Removes the shared Google Calendar connection from service_configs for the given service.
 * staff_id is accepted for backwards compatibility but the connection is service-scoped.
 */

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staff_id");
  const serviceId = searchParams.get("service_id");

  if (!staffId || !serviceId) {
    return NextResponse.json(
      { error: "staff_id and service_id query parameters are required" },
      { status: 400 },
    );
  }

  try {
    const adminClient = getAdminClient();

    const { error } = await adminClient.database
      .from("service_configs")
      .delete()
      .eq("service_id", serviceId);

    if (error) {
      console.error("[google/calendar/disconnect-user] db error:", error);
      return NextResponse.json(
        { error: "Failed to disconnect" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[google/calendar/disconnect-user] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
