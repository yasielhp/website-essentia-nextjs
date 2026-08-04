import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar";
import { bookableServices } from "@/data/services-data";
import {
  ADMIN_ROLES,
  requireApiRole,
  toAuthErrorResponse,
} from "@/lib/auth-guard";
import { signState } from "@/lib/oauth-state";

/**
 * POST /api/google/calendar/connect  { service_id }
 *
 * Returns the Google consent URL for a service calendar. Admin only.
 *
 * This was a `GET` that redirected straight to Google, so a plain link could
 * start the flow for any service without authentication. It is now a POST, so
 * the caller's bearer token can be checked, and the `state` is signed so the
 * callback only accepts flows this server started.
 */
export async function POST(request: Request) {
  try {
    await requireApiRole(request, ADMIN_ROLES);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  let body: { service_id?: string };
  try {
    body = (await request.json()) as { service_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const serviceId = body.service_id;
  if (!serviceId) {
    return NextResponse.json(
      { error: "Missing service_id parameter" },
      { status: 400 },
    );
  }

  if (!bookableServices.some((s) => s.id === serviceId)) {
    return NextResponse.json(
      { error: `Unknown service: ${serviceId}` },
      { status: 400 },
    );
  }

  return NextResponse.json({ url: getGoogleAuthUrl(signState(serviceId)) });
}
