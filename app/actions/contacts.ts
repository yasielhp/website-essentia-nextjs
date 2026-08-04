"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";
import type {
  ContactBooking,
  ContactDetail,
  ContactDetailResult,
  ContactEduReg,
  ContactRaceReg,
  ContactRow,
  UpdateContactPayload,
} from "@/types/contact";

export type {
  ContactBooking,
  ContactDetail,
  ContactDetailResult,
  ContactEduReg,
  ContactRaceReg,
  ContactRow,
};

/**
 * Contact directory. Every function here reads or writes personal data with the
 * service key, so all of them require a dashboard role — these actions are
 * public HTTP endpoints and previously exposed the whole contact database.
 */

export async function fetchContacts(
  accessToken: string | null,
  page: number,
  pageSize: number,
): Promise<{ contacts: ContactRow[]; total: number }> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { contacts: [], total: 0 };
    throw err;
  }

  const safePage = Math.max(0, Math.floor(page));
  const safeSize = Math.min(Math.max(1, Math.floor(pageSize)), 200);

  const { data, count } = await getAdminClient()
    .database.from("contacts")
    .select("id, first_name, last_name, email, phone, status, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(safePage * safeSize, safePage * safeSize + safeSize - 1);

  return {
    contacts: (data as ContactRow[] | null) ?? [],
    total: count ?? 0,
  };
}

export async function fetchContactDetail(
  accessToken: string | null,
  id: string,
): Promise<ContactDetailResult> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { found: false };
    throw err;
  }

  const db = getAdminClient().database;

  const [
    { data: contacts, error: contactError },
    { data: bookingData },
    { data: raceRegData },
    { data: eduRegData },
  ] = await Promise.all([
    db
      .from("contacts")
      .select(
        "id, first_name, last_name, email, phone, newsletter_subscribed, preferred_language",
      )
      .eq("id", id)
      .limit(1),
    db
      .from("bookings")
      .select("id, service_title, date, time, status, created_at")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("race_registrations")
      .select("id, created_at, race_id")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("education_registrations")
      .select("id, created_at, session_id")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (contactError) {
    console.error(
      "[fetchContactDetail] query error:",
      (contactError as { message?: string })?.message,
    );
  }
  const contact = (contacts as ContactDetail[] | null)?.[0];
  if (!contact) return { found: false };

  const raceRows =
    (raceRegData as
      | { id: string; created_at: string | null; race_id: string }[]
      | null) ?? [];
  const eduRows =
    (eduRegData as
      | { id: string; created_at: string | null; session_id: string }[]
      | null) ?? [];

  const raceIds = raceRows.map((r) => r.race_id);
  const sessionIds = eduRows.map((r) => r.session_id);

  const [{ data: racesData }, { data: sessionsData }] = await Promise.all([
    raceIds.length > 0
      ? db.from("races").select("id, title, date, location").in("id", raceIds)
      : Promise.resolve({ data: [] }),
    sessionIds.length > 0
      ? db
          .from("education_sessions")
          .select("id, title, date, location")
          .in("id", sessionIds)
      : Promise.resolve({ data: [] }),
  ]);

  type EventRow = {
    id: string;
    title: string | null;
    date: string | null;
    location: string | null;
  };
  const racesMap = new Map(
    ((racesData as EventRow[]) ?? []).map((r) => [r.id, r]),
  );
  const sessionsMap = new Map(
    ((sessionsData as EventRow[]) ?? []).map((s) => [s.id, s]),
  );

  return {
    found: true,
    contact,
    bookings: (bookingData as ContactBooking[] | null) ?? [],
    raceRegs: raceRows.map((r) => ({
      ...r,
      race: racesMap.get(r.race_id) ?? null,
    })),
    eduRegs: eduRows.map((r) => ({
      ...r,
      session: sessionsMap.get(r.session_id) ?? null,
    })),
  };
}

export async function updateContact(
  accessToken: string | null,
  id: string,
  payload: UpdateContactPayload,
): Promise<{ error: string | null }> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  const { error } = await getAdminClient()
    .database.from("contacts")
    .update(payload)
    .eq("id", id);
  return { error: (error as { message?: string } | null)?.message ?? null };
}

export async function fetchContactRoleCounts(
  accessToken: string | null,
): Promise<{ leads: number; clients: number }> {
  try {
    await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) return { leads: 0, clients: 0 };
    throw err;
  }

  const db = getAdminClient().database;
  const [leadsRes, clientsRes] = await Promise.all([
    db
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .or("status.eq.lead,status.is.null"),
    db
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("status", "client"),
  ]);

  return {
    leads: (leadsRes as { count: number | null }).count ?? 0,
    clients: (clientsRes as { count: number | null }).count ?? 0,
  };
}
