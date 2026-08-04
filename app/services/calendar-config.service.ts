import { getAdminClient } from "@/lib/insforge-admin";

/**
 * Data access for Google Calendar wiring (`service_configs`, `staff_services`).
 *
 * The route handlers used to embed these queries inline, each with its own
 * `getAdminClient()` copy. Keeping them here means the routes only deal with
 * authorisation, validation and HTTP.
 *
 * Nothing in this module returns token columns — routes must never leak them.
 */

export type ServiceConnection = {
  service_id: string;
  google_connected_email: string | null;
  google_calendar_id: string | null;
};

/** Connection metadata for every configured service. Never includes tokens. */
export async function listServiceConnections(): Promise<ServiceConnection[]> {
  const { data, error } = await getAdminClient()
    .database.from("service_configs")
    .select("service_id, google_connected_email, google_calendar_id");

  if (error) {
    console.error("[calendar-config] listServiceConnections:", error);
    return [];
  }
  return (data as ServiceConnection[] | null) ?? [];
}

/** The calendar a service writes to, defaulting to the account's primary. */
export async function getServiceCalendarId(serviceId: string): Promise<string> {
  const { data } = await getAdminClient()
    .database.from("service_configs")
    .select("google_calendar_id")
    .eq("service_id", serviceId)
    .maybeSingle();

  return (
    (data as { google_calendar_id: string | null } | null)
      ?.google_calendar_id ?? "primary"
  );
}

/** Removes a service's calendar connection entirely. */
export async function deleteServiceConnection(
  serviceId: string,
): Promise<{ error: string | null }> {
  const { error } = await getAdminClient()
    .database.from("service_configs")
    .delete()
    .eq("service_id", serviceId);

  return { error: (error as { message?: string } | null)?.message ?? null };
}

/** Ids of the services a staff member is assigned to. */
export async function listStaffServiceIds(staffId: string): Promise<string[]> {
  const { data, error } = await getAdminClient()
    .database.from("staff_services")
    .select("service_id")
    .eq("staff_id", staffId);

  if (error) {
    console.error("[calendar-config] listStaffServiceIds:", error);
    return [];
  }
  return ((data as { service_id: string }[] | null) ?? []).map(
    (r) => r.service_id,
  );
}

/** Connected Google account per service, for a set of service ids. */
export async function getConnectedEmails(
  serviceIds: string[],
): Promise<Record<string, string | null>> {
  if (serviceIds.length === 0) return {};

  const { data, error } = await getAdminClient()
    .database.from("service_configs")
    .select("service_id, google_connected_email")
    .in("service_id", serviceIds);

  if (error) {
    console.error("[calendar-config] getConnectedEmails:", error);
    return {};
  }

  const map: Record<string, string | null> = {};
  for (const row of (data as
    | { service_id: string; google_connected_email: string | null }[]
    | null) ?? []) {
    map[row.service_id] = row.google_connected_email;
  }
  return map;
}

/** Titles of the services a staff member is assigned to. */
export async function listStaffServices(
  staffId: string,
): Promise<{ id: string; title: string }[]> {
  const serviceIds = await listStaffServiceIds(staffId);
  if (serviceIds.length === 0) return [];

  const { data, error } = await getAdminClient()
    .database.from("service_settings")
    .select("id, title")
    .in("id", serviceIds);

  if (error) {
    console.error("[calendar-config] listStaffServices:", error);
    return [];
  }
  return (data as { id: string; title: string }[] | null) ?? [];
}

/** Staff members assigned to a service who have their own calendar token. */
export async function listStaffWithCalendar(
  serviceId: string,
): Promise<string[]> {
  const { data } = await getAdminClient()
    .database.from("staff_services")
    .select("staff_id, google_access_token")
    .eq("service_id", serviceId)
    .not("google_access_token", "is", null);

  return (
    (data as
      | { staff_id: string; google_access_token: string | null }[]
      | null) ?? []
  )
    .filter((r) => !!r.google_access_token)
    .map((r) => r.staff_id);
}

/** Other services that have a calendar connected, used as a shared fallback. */
export async function listOtherConnectedServices(
  excludeServiceId: string,
  limit = 5,
): Promise<string[]> {
  const { data } = await getAdminClient()
    .database.from("service_configs")
    .select("service_id")
    .not("google_access_token", "is", null)
    .neq("service_id", excludeServiceId)
    .limit(limit);

  return ((data as { service_id: string }[] | null) ?? []).map(
    (r) => r.service_id,
  );
}
