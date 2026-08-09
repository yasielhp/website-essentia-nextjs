import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";
import { deleteServiceConnection } from "@/services/calendar-config.service";
import { getAdminClient } from "@/lib/insforge-admin";

/**
 * DELETE /api/google/calendar/disconnect-user?staff_id=UUID[&service_id=UUID]
 *
 * Without `service_id`, clears the person's own calendar tokens on `profiles`.
 * With it, removes the shared service-level connection instead.
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

  if (!staffId) {
    return NextResponse.json(
      { error: "staff_id query parameter is required" },
      { status: 400 },
    );
  }

  if (caller.role !== "admin" && caller.userId !== staffId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!serviceId) {
    const { error: profileError } = await getAdminClient()
      .database.from("profiles")
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
        google_connected_email: null,
      })
      .eq("id", staffId);

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to disconnect" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
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
