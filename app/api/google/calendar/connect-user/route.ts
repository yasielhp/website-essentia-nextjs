import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

/**
 * GET /api/google/calendar/connect-user?user_id=UUID&return_to=/dashboard/account
 *
 * Initiates the Google OAuth flow for an individual staff user.
 * Encodes user_id and return_to into the OAuth `state` parameter so the
 * callback can store tokens in the profiles table and redirect back to the
 * correct page.
 *
 * State format: `user__${userId}__${encodeURIComponent(returnPath)}`
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const returnTo = searchParams.get("return_to");

  if (!userId || !returnTo) {
    return NextResponse.json(
      { error: "user_id and return_to query parameters are required" },
      { status: 400 },
    );
  }

  const state = `user__${userId}__${encodeURIComponent(returnTo)}`;
  const authUrl = getGoogleAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
