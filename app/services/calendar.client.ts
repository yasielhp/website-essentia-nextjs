"use client";

import { authFetch } from "@/lib/client-session";

/**
 * Browser-side calls to the Google Calendar routes.
 *
 * Every one of these endpoints is guarded by `requireApiRole()`, so each request
 * must carry the caller's access token — `authFetch` attaches it. Keeping the
 * calls here means no dashboard page has to remember that.
 *
 * The connect flows are POST-then-redirect rather than plain links: a link
 * cannot carry an Authorization header, so the server hands back a signed
 * consent URL and the browser navigates to it.
 */

async function startOAuth(
  endpoint: string,
  body: Record<string, string>,
): Promise<{ error: string | null }> {
  const res = await authFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { error: payload?.error ?? "No se pudo iniciar la conexión." };
  }

  const { url } = (await res.json()) as { url: string };
  window.location.href = url;
  return { error: null };
}
/** Starts the OAuth flow for a staff member's service calendar. */
export function connectStaffCalendar(
  staffId: string,
  serviceId: string,
  returnTo: string,
) {
  return startOAuth("/api/google/calendar/connect-user", {
    staff_id: staffId,
    service_id: serviceId,
    return_to: returnTo,
  });
}

/** Starts the OAuth flow for a person's own calendar. */
export function connectAccountCalendar(staffId: string, returnTo: string) {
  return startOAuth("/api/google/calendar/connect-user", {
    staff_id: staffId,
    return_to: returnTo,
  });
}

/** Removes a person's own calendar connection. */
export async function disconnectAccountCalendar(staffId: string) {
  await authFetch(`/api/google/calendar/disconnect-user?staff_id=${staffId}`, {
    method: "DELETE",
  });
}

/** Pushes a person's unsynced future bookings to their calendar. */
export async function resyncAccountCalendar(
  staffId: string,
): Promise<{ synced: number; failed: number } | null> {
  const res = await authFetch("/api/google/calendar/sync-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staff_id: staffId }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { synced: number; failed: number };
}
/** Removes a staff member's service calendar connection. */
export async function disconnectStaffCalendar(
  staffId: string,
  serviceId: string,
): Promise<void> {
  await authFetch(
    `/api/google/calendar/disconnect-user?staff_id=${staffId}&service_id=${serviceId}`,
    { method: "DELETE" },
  );
}

export type ServiceConnectionRow = {
  service_id: string;
  google_connected_email: string | null;
  google_calendar_id: string | null;
};
/** Connection status for the services assigned to a staff member. */
export async function fetchStaffCalendarConfigs(
  staffId: string,
): Promise<{ service_id: string; google_calendar_email: string | null }[]> {
  const res = await authFetch(
    `/api/google/calendar/user-config?staff_id=${staffId}`,
  );
  if (!res.ok) return [];
  const { configs } = (await res.json()) as {
    configs: { service_id: string; google_calendar_email: string | null }[];
  };
  return configs ?? [];
}

/** Services assigned to a staff member, with titles. */
export async function fetchStaffServices(
  staffId: string,
): Promise<{ id: string; title: string }[]> {
  const res = await authFetch(
    `/api/google/calendar/staff-services?staff_id=${staffId}`,
  );
  if (!res.ok) return [];
  const { services } = (await res.json()) as {
    services: { id: string; title: string }[];
  };
  return services ?? [];
}
