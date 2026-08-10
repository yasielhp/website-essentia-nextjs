import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_ROLES,
  requireApiRole,
  toAuthErrorResponse,
} from "@/lib/auth-guard";
import { syncAllCalendars } from "@/lib/calendar-sync";

/**
 * The Settings button. The work itself is in `lib/calendar-sync`, shared with
 * the hourly job, so pressing this and waiting for the hour do the same thing.
 *
 * POST /api/google/calendar/sync-all
 */
export async function POST(request: NextRequest) {
  try {
    await requireApiRole(request, ADMIN_ROLES);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  return NextResponse.json({ ok: true, ...(await syncAllCalendars()) });
}
