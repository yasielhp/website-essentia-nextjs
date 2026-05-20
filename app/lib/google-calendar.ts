import { createClient } from "@insforge/sdk";

// ─── Admin client (service key — never exposed to the browser) ───────────────

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoogleTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export type GoogleCalendarEvent = {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

type ServiceConfigRow = {
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: string | null;
  google_calendar_id: string | null;
};

// ─── OAuth helpers ────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

/**
 * Generate a Google OAuth URL, encoding `state` as the OAuth state parameter.
 * Pass a serviceId string for the service-level flow, or a
 * `user__${userId}__${encodedReturnPath}` string for the user-level flow.
 */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<GoogleTokens>;
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return { access_token: data.access_token, expires_in: data.expires_in };
}

// ─── Calendar API helpers ─────────────────────────────────────────────────────

/**
 * Fetch all calendar IDs accessible to the user (including non-primary ones).
 */
async function listCalendarIds(accessToken: string): Promise<string[]> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return ["primary"];
  const data = (await res.json()) as {
    items?: { id: string; accessRole: string }[];
  };
  return (data.items ?? []).map((c) => c.id).filter(Boolean);
}

/**
 * Query Google Calendar FreeBusy API across ALL user calendars for the local day `date`.
 * Uses ±1 day window so UTC offsets don't cause missed events.
 */
export async function getFreeBusy(
  accessToken: string,
  _calendarId: string, // kept for backwards-compat, now ignored — all calendars queried
  date: string, // "YYYY-MM-DD" in LOCAL time
): Promise<{ start: string; end: string }[]> {
  // Use a full UTC day as query window; local business hours always fall within this range
  const timeMin = `${date}T00:00:00Z`;
  const timeMax = `${date}T23:59:59Z`;

  // Get all calendars for the user so we catch non-primary ones (e.g. "Essentia Longevity Center")
  const calendarIds = await listCalendarIds(accessToken);

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google freeBusy failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    calendars: Record<string, { busy: { start: string; end: string }[] }>;
  };

  // Merge busy intervals from all calendars
  return Object.values(data.calendars).flatMap((cal) => cal.busy ?? []);
}

/**
 * Create a Google Calendar event and return the created event's ID.
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEvent,
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google createEvent failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Retrieve a valid access token for `serviceId` from service_configs.
 * Automatically refreshes the token if it has expired (or will expire within 60s).
 * Returns null if no Google Calendar is connected for this service.
 */
export async function getValidAccessToken(
  serviceId: string,
): Promise<string | null> {
  const adminClient = getAdminClient();

  const { data, error } = await adminClient.database
    .from("service_configs")
    .select(
      "google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id",
    )
    .eq("service_id", serviceId)
    .single<ServiceConfigRow>();

  if (
    error ||
    !data ||
    !data.google_access_token ||
    !data.google_refresh_token
  ) {
    return null;
  }

  const expiresAt = data.google_token_expires_at
    ? new Date(data.google_token_expires_at).getTime()
    : 0;

  const nowMs = Date.now();
  const bufferMs = 60 * 1000; // refresh 60s before expiry

  if (expiresAt - nowMs > bufferMs) {
    // Token still valid
    return data.google_access_token;
  }

  // Token expired — refresh it
  try {
    const refreshed = await refreshGoogleToken(data.google_refresh_token);
    const newExpiresAt = new Date(
      nowMs + refreshed.expires_in * 1000,
    ).toISOString();

    await adminClient.database
      .from("service_configs")
      .update({
        google_access_token: refreshed.access_token,
        google_token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("service_id", serviceId);

    return refreshed.access_token;
  } catch {
    return null;
  }
}

type StaffServiceRow = {
  staff_id: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: string | null;
};

/**
 * Get a valid access token for a staff+service pair from staff_services.
 * Refreshes automatically if expired. Returns null if no calendar connected.
 */
export async function getStaffServiceAccessToken(
  staffId: string,
  serviceId: string,
): Promise<string | null> {
  const adminClient = getAdminClient();

  const { data, error } = await adminClient.database
    .from("staff_services")
    .select(
      "staff_id, google_access_token, google_refresh_token, google_token_expires_at",
    )
    .eq("staff_id", staffId)
    .eq("service_id", serviceId)
    .single<StaffServiceRow>();

  if (error || !data?.google_access_token || !data?.google_refresh_token) {
    return null;
  }

  const expiresAt = data.google_token_expires_at
    ? new Date(data.google_token_expires_at).getTime()
    : 0;

  if (expiresAt - Date.now() > 60 * 1000) {
    return data.google_access_token;
  }

  try {
    const refreshed = await refreshGoogleToken(data.google_refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await adminClient.database
      .from("staff_services")
      .update({
        google_access_token: refreshed.access_token,
        google_token_expires_at: newExpiresAt,
      })
      .eq("staff_id", staffId)
      .eq("service_id", serviceId);

    return refreshed.access_token;
  } catch {
    return null;
  }
}
