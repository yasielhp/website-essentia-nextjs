import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * DELETE /api/google/calendar/disconnect-user?user_id=UUID
 *
 * Clears all Google Calendar token columns from the user's profiles row,
 * effectively disconnecting their personal Google Calendar integration.
 */

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json(
      { error: "user_id query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const adminClient = getAdminClient();

    const { error } = await adminClient.database
      .from("profiles")
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
        google_connected_email: null,
      })
      .eq("id", userId);

    if (error) {
      console.error("[google/calendar/disconnect-user] db error:", error);
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[google/calendar/disconnect-user] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
