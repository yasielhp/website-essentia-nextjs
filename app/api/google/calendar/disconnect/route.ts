import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_ROLES,
  requireApiRole,
  toAuthErrorResponse,
} from "@/lib/auth-guard";
import { deleteServiceConnection } from "@/services/calendar-config.service";

/**
 * DELETE /api/google/calendar/disconnect?service_id=UUID
 *
 * Removes a service's Google Calendar connection. Admin only — this was open to
 * anyone, so a single unauthenticated request could break booking availability.
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireApiRole(request, ADMIN_ROLES);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const serviceId = new URL(request.url).searchParams.get("service_id");
  if (!serviceId) {
    return NextResponse.json(
      { error: "Missing service_id parameter" },
      { status: 400 },
    );
  }

  const { error } = await deleteServiceConnection(serviceId);
  if (error) {
    return NextResponse.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
