import { NextResponse } from "next/server";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";
import { listServiceConnections } from "@/services/calendar-config.service";

/**
 * GET /api/google/calendar/configs
 *
 * Google Calendar connection status for every service. Staff only — the
 * response includes the connected Google account address, which is internal.
 * Token fields are never selected.
 */
export async function GET(request: Request) {
  try {
    await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  return NextResponse.json({ data: await listServiceConnections() });
}
