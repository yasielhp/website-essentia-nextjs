import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";
import { signState } from "@/lib/oauth-state";

/**
 * POST /api/google/calendar/connect-user  { staff_id, return_to, service_id? }
 *
 * Returns the Google consent URL for a staff member's calendar. Staff may only
 * connect their own; admins may act for anyone.
 *
 * Without `service_id` the tokens land on the person's `profiles` row, which
 * is where they belong: a therapist has one calendar, not one per treatment.
 * With it, the legacy per-service connection is kept for the services that
 * still hold their own calendar.
 *
 * State: `user__${staffId}__${encodedReturnPath}`, or
 * `staffsvc__${staffId}__${serviceId}__${encodedReturnPath}`, wrapped in a
 * signature so the callback rejects states it did not issue.
 */
export async function POST(request: Request) {
  let caller;
  try {
    caller = await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  let body: { staff_id?: string; service_id?: string; return_to?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    staff_id: staffId,
    service_id: serviceId,
    return_to: returnTo,
  } = body;

  if (!staffId || !returnTo) {
    return NextResponse.json(
      { error: "staff_id and return_to are required" },
      { status: 400 },
    );
  }

  if (caller.role !== "admin" && caller.userId !== staffId) {
    return NextResponse.json(
      { error: "You can only connect your own calendar" },
      { status: 403 },
    );
  }

  // Only same-origin dashboard paths may be used as the post-OAuth destination.
  if (!returnTo.startsWith("/dashboard")) {
    return NextResponse.json({ error: "Invalid return_to" }, { status: 400 });
  }

  const state = serviceId
    ? `staffsvc__${staffId}__${serviceId}__${encodeURIComponent(returnTo)}`
    : `user__${staffId}__${encodeURIComponent(returnTo)}`;

  return NextResponse.json({ url: getGoogleAuthUrl(signState(state)) });
}
