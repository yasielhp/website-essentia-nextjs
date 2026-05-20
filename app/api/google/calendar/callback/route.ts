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
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // ── Determine flow ────────────────────────────────────────────────────────────
  const isStaffSvcFlow = stateParam?.startsWith("staffsvc__") ?? false;
  // Keep legacy user__ check in case old links are still in flight
  const isUserFlow =
    !isStaffSvcFlow && (stateParam?.startsWith("user__") ?? false);

  const errorRedirectBase =
    isStaffSvcFlow || isUserFlow
      ? "/dashboard/account"
      : "/dashboard/settings?tab=services";

  if (errorParam) {
    return NextResponse.redirect(
      new URL(
        `${errorRedirectBase}&error=${encodeURIComponent(errorParam)}`,
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL(
        `${errorRedirectBase}&error=missing_params`,
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

    if (isStaffSvcFlow) {
      // ── Staff+service flow: store tokens in staff_services ────────────────────
      // state format: `staffsvc__${staffId}__${serviceId}__${encodedReturnPath}`
      const parts = stateParam.split("__");
      const staffId = parts[1];
      const serviceId = parts[2];
      const encodedReturnPath = parts.slice(3).join("__");
      const returnPath = decodeURIComponent(encodedReturnPath);

      if (!staffId || !serviceId) {
        return NextResponse.redirect(
          new URL(
            `${errorRedirectBase}?error=invalid_state`,
            process.env.NEXT_PUBLIC_APP_URL,
          ),
        );
      }

      await adminClient.database
        .from("staff_services")
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expires_at: expiresAt,
          google_calendar_email: connectedEmail,
        })
        .eq("staff_id", staffId)
        .eq("service_id", serviceId);

      return NextResponse.redirect(
        new URL(
          `${returnPath}?calendar_connected=1`,
          process.env.NEXT_PUBLIC_APP_URL,
        ),
      );
    } else if (isUserFlow) {
      // ── Legacy user-level flow (profiles table) ───────────────────────────────
      const parts = stateParam.split("__");
      const userId = parts[1];
      const encodedReturnPath = parts.slice(2).join("__");
      const returnPath = decodeURIComponent(encodedReturnPath);

      if (!userId) {
        return NextResponse.redirect(
          new URL(
            `${errorRedirectBase}?error=invalid_state`,
            process.env.NEXT_PUBLIC_APP_URL,
          ),
        );
      }

      await adminClient.database
        .from("profiles")
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expires_at: expiresAt,
          google_connected_email: connectedEmail,
        })
        .eq("id", userId);

      return NextResponse.redirect(
        new URL(
          `${returnPath}?calendar_connected=1`,
          process.env.NEXT_PUBLIC_APP_URL,
        ),
      );
    } else {
      // ── Service-level flow: store tokens in service_configs (unchanged) ───────
      const serviceId = stateParam;

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
    }
  } catch (err) {
    console.error("[google/calendar/callback] error:", err);
    return NextResponse.redirect(
      new URL(
        `${errorRedirectBase}&error=token_exchange_failed`,
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  }
}
