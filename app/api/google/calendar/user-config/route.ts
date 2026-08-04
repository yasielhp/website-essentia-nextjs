import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";
import {
  getConnectedEmails,
  listStaffServiceIds,
} from "@/services/calendar-config.service";

/**
 * GET /api/google/calendar/user-config?staff_id=UUID
 *
 * Calendar connection status for each service assigned to a staff member.
 * Staff may only read their own; admins may read anyone's.
 *
 * Response: `{ configs: { service_id, google_calendar_email }[] }`
 */
export async function GET(request: NextRequest) {
  let caller;
  try {
    caller = await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const staffId = new URL(request.url).searchParams.get("staff_id");
  if (!staffId) {
    return NextResponse.json(
      { error: "staff_id query parameter is required" },
      { status: 400 },
    );
  }

  if (caller.role !== "admin" && caller.userId !== staffId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceIds = await listStaffServiceIds(staffId);
  if (serviceIds.length === 0) {
    return NextResponse.json({ configs: [] });
  }

  const emails = await getConnectedEmails(serviceIds);

  return NextResponse.json({
    configs: serviceIds.map((id) => ({
      service_id: id,
      google_calendar_email: emails[id] ?? null,
    })),
  });
}
