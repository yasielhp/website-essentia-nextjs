import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import { verifyState } from "@/lib/oauth-state";
import { getAppUrl } from "@/lib/env";

/**
 * Google OAuth callback. Public by necessity — Google calls it — but it only
 * acts on a `state` this server signed, so it cannot be used to rebind a
 * service's calendar to an attacker's Google account.
 */

function redirectTo(path: string, params: Record<string, string> = {}) {
  const url = new URL(path, getAppUrl());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const signedState = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const state = verifyState(signedState);

  const isStaffSvcFlow = state?.startsWith("staffsvc__") ?? false;
  // Legacy `user__` links may still be in flight.
  const isUserFlow = !isStaffSvcFlow && (state?.startsWith("user__") ?? false);

  const errorRedirectBase =
    isStaffSvcFlow || isUserFlow
      ? "/dashboard/account"
      : "/dashboard/bookings/settings";

  if (errorParam) {
    return redirectTo(errorRedirectBase, { error: errorParam });
  }

  if (!code || !signedState) {
    return redirectTo(errorRedirectBase, { error: "missing_params" });
  }

  if (!state) {
    // Unsigned, tampered or expired state — never exchange the code.
    return redirectTo(errorRedirectBase, { error: "invalid_state" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const userinfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    // `fetch` resolves on 4xx, and Google answers errors with a JSON body of
    // its own. Reading it blind stored `null` as the connected address and the
    // dashboard then showed the calendar as connected to nobody.
    const userinfo = userinfoRes.ok
      ? ((await userinfoRes.json()) as { email?: string })
      : null;
    const connectedEmail = userinfo?.email ?? null;

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();

    const db = getAdminClient().database;

    const calendarTokens = {
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      google_token_expires_at: expiresAt,
      google_connected_email: connectedEmail,
      google_calendar_id: "primary",
      updated_at: new Date().toISOString(),
    };

    if (isStaffSvcFlow) {
      // state: `staffsvc__${staffId}__${serviceId}__${encodedReturnPath}`
      const parts = state.split("__");
      const serviceId = parts[2];
      const returnPath = decodeURIComponent(parts.slice(3).join("__"));

      if (!serviceId || !returnPath.startsWith("/dashboard")) {
        return redirectTo(errorRedirectBase, { error: "invalid_state" });
      }

      await db
        .from("service_configs")
        .upsert(
          { service_id: serviceId, ...calendarTokens },
          { onConflict: "service_id" },
        );

      return redirectTo(returnPath, { calendar_connected: "1" });
    }

    if (isUserFlow) {
      // Legacy user-level flow (profiles table)
      const parts = state.split("__");
      const userId = parts[1];
      const returnPath = decodeURIComponent(parts.slice(2).join("__"));

      if (!userId || !returnPath.startsWith("/dashboard")) {
        return redirectTo(errorRedirectBase, { error: "invalid_state" });
      }

      await db
        .from("profiles")
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expires_at: expiresAt,
          google_connected_email: connectedEmail,
        })
        .eq("id", userId);

      return redirectTo(returnPath, { calendar_connected: "1" });
    }

    // Service-level flow: `state` is the service id itself.
    await db
      .from("service_configs")
      .upsert(
        { service_id: state, ...calendarTokens },
        { onConflict: "service_id" },
      );

    return redirectTo("/dashboard/bookings/settings", { connected: "1" });
  } catch (err) {
    console.error("[google/calendar/callback] error:", err);
    return redirectTo(errorRedirectBase, { error: "token_exchange_failed" });
  }
}
