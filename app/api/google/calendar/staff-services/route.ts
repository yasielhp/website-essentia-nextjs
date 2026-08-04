import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";
import { listStaffServices } from "@/services/calendar-config.service";

/**
 * GET /api/google/calendar/staff-services?staff_id=UUID
 *
 * Services assigned to a staff member, with titles. Staff may only read their
 * own assignments; admins may read anyone's.
 *
 * Response: `{ services: { id, title }[] }`
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

  return NextResponse.json({ services: await listStaffServices(staffId) });
}
