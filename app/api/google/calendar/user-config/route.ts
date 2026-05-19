import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/google/calendar/user-config?user_id=UUID
 *
 * Returns the Google Calendar connection status for a staff user.
 * Reads google_connected_email and google_token_expires_at from the
 * profiles table using the admin client.
 *
 * Response: { google_connected_email: string | null }
 */

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function GET(request: NextRequest) {
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

    const { data, error } = await adminClient.database
      .from("profiles")
      .select("google_connected_email, google_token_expires_at")
      .eq("id", userId)
      .single<{
        google_connected_email: string | null;
        google_token_expires_at: string | null;
      }>();

    if (error) {
      console.error("[google/calendar/user-config] db error:", error);
      return NextResponse.json(
        { error: "Failed to fetch user config" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      google_connected_email: data?.google_connected_email ?? null,
    });
  } catch (err) {
    console.error("[google/calendar/user-config] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
