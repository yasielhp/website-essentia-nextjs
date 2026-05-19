import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { exchangeCodeForTokens } from "@/lib/google-calendar";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const serviceId = searchParams.get("state"); // state = serviceId (set in getGoogleAuthUrl)
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?tab=services&error=${encodeURIComponent(errorParam)}`,
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  }

  if (!code || !serviceId) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?tab=services&error=missing_params",
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Fetch the connected Google account's email
    const userinfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    const userinfo = (await userinfoRes.json()) as { email?: string };
    const connectedEmail = userinfo.email ?? null;

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();

    const adminClient = getAdminClient();

    await adminClient.database.from("service_configs").upsert(
      {
        service_id: serviceId,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expires_at: expiresAt,
        google_connected_email: connectedEmail,
        google_calendar_id: "primary",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service_id" },
    );

    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?tab=services&connected=1",
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  } catch (err) {
    console.error("[google/calendar/callback] error:", err);
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?tab=services&error=token_exchange_failed",
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  }
}
