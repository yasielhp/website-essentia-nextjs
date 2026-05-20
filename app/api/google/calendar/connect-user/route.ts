import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

/**
 * GET /api/google/calendar/connect-user?staff_id=UUID&service_id=UUID&return_to=/dashboard/account
 *
 * Initiates Google OAuth for a staff member linked to a specific service.
 * State format: `staffsvc__${staffId}__${serviceId}__${encodeURIComponent(returnPath)}`
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staff_id");
  const serviceId = searchParams.get("service_id");
  const returnTo = searchParams.get("return_to");

  if (!staffId || !serviceId || !returnTo) {
    return NextResponse.json(
      { error: "staff_id, service_id and return_to query parameters are required" },
      { status: 400 },
    );
  }

  const state = `staffsvc__${staffId}__${serviceId}__${encodeURIComponent(returnTo)}`;
  const authUrl = getGoogleAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
