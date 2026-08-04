import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";
import { deleteServiceConnection } from "@/services/calendar-config.service";

/**
 * DELETE /api/google/calendar/disconnect-user?staff_id=UUID&service_id=UUID
 *
 * Removes the shared Google Calendar connection for a service. `staff_id` is
 * kept for backwards compatibility — the connection itself is service-scoped.
 *
 * Staff may only disconnect their own; admins may disconnect anyone's.
 */
export async function DELETE(request: NextRequest) {
  let caller;
  try {
    caller = await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staff_id");
  const serviceId = searchParams.get("service_id");

  if (!staffId || !serviceId) {
    return NextResponse.json(
      { error: "staff_id and service_id query parameters are required" },
      { status: 400 },
    );
  }

  if (caller.role !== "admin" && caller.userId !== staffId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await deleteServiceConnection(serviceId);
  if (error) {
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
