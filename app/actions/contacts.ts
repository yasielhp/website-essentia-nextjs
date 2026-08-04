"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";
import type {
  ContactBooking,
  ContactStatus,
  ContactDetail,
  ContactDetailResult,
  ContactRow,
  UpdateContactPayload,
} from "@/types/contact";

/**
 * Contact directory. Every function here reads or writes personal data with the
 * service key, so all of them require a dashboard role — these actions are
 * public HTTP endpoints and previously exposed the whole contact database.
 */

/**
 * A page of contacts, optionally narrowed by status and email.
 *
 * The status filter belongs here rather than in the component: the list is
 * paginated server-side, so filtering the fetched page would only ever search
 * the 20 rows on screen. A single lead sitting on page 4 looked like no lead
 * at all.
 */
export async function fetchContacts(
  accessToken: string | null,
  page: number,
  pageSize: number,
  status?: ContactStatus,
  email?: string,
): Promise<{ contacts: ContactRow[]; total: number }> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { contacts: [], total: 0 };
    throw err;
  }

  const safePage = Math.max(0, Math.floor(page));
  const safeSize = Math.min(Math.max(1, Math.floor(pageSize)), 200);

  let query = getAdminClient()
    .database.from("contacts")
    .select(
      "id, first_name, last_name, email, phone, gender, status, created_at",
      { count: "exact" },
    );

  // Rows created before the column existed carry NULL, which the dashboard
  // shows as a lead — the count query treats them the same way.
  if (status === "lead") {
    query = query.or("status.eq.lead,status.is.null");
  } else if (status) {
    query = query.eq("status", status);
  }

  // Matching here rather than over the fetched page, for the same reason the
  // status filter lives here: an address on page 4 is invisible to a filter
  // that only sees page 1. `*` would widen the pattern beyond what was typed,
  // so it is stripped.
  const term = email?.trim().replace(/\*/g, "");
  if (term) {
    query = query.ilike("email", `*${term}*`);
  }

  const { data, count } = await query
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

  // The contact is fetched first because its email is needed to find bookings:
  // 81 of 100 rows carry no `contact_id`, since dashboard-created bookings
  // never set one. Matching on the address as well surfaces that history.
  const { data: contacts, error: contactError } = await db
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, gender, newsletter_subscribed, preferred_language",
    )
    .eq("id", id)
    .limit(1);

  if (contactError) {
    console.error(
      "[fetchContactDetail] query error:",
      (contactError as { message?: string })?.message,
    );
  }
  const contact = (contacts as ContactDetail[] | null)?.[0];
  if (!contact) return { found: false };

  const bookingFields =
    "id, service_title, date, time, status, payment_status, price_eur, created_at";

  const [
    { data: linkedBookings },
    { data: emailBookings },
    { data: raceRegData },
    { data: eduRegData },
  ] = await Promise.all([
    db
      .from("bookings")
      .select(bookingFields)
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    // Two queries merged by id rather than one `or(...)`: an address embedded
    // in PostgREST filter syntax would need escaping, and getting that wrong
    // silently changes which rows match.
    contact.email
      ? db
          .from("bookings")
          .select(bookingFields)
          .ilike("email", contact.email)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
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

  const bookingsById = new Map<string, ContactBooking>();
  for (const row of [
    ...((linkedBookings as ContactBooking[] | null) ?? []),
    ...((emailBookings as ContactBooking[] | null) ?? []),
  ]) {
    bookingsById.set(row.id, row);
  }
  const bookingData = [...bookingsById.values()].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );

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
    bookings: bookingData,
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
