"use server";

import { createClient } from "@insforge/sdk";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
    isServerMode: true,
  });
}

export type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string | null;
};

export async function fetchContacts(
  page: number,
  pageSize: number,
): Promise<{ contacts: ContactRow[]; total: number }> {
  const { data, count } = await getAdminClient()
    .database.from("contacts")
    .select("id, first_name, last_name, email, phone, status, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  return {
    contacts: (data as ContactRow[] | null) ?? [],
    total: count ?? 0,
  };
}

export type ContactDetail = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  newsletter_subscribed: boolean | null;
  preferred_language: string | null;
};

export type ContactBooking = {
  id: string;
  service_title: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  created_at: string | null;
};

export type ContactRaceReg = {
  id: string;
  created_at: string | null;
  race_id: string;
  race: {
    title: string | null;
    date: string | null;
    location: string | null;
  } | null;
};

export type ContactEduReg = {
  id: string;
  created_at: string | null;
  session_id: string;
  session: {
    title: string | null;
    date: string | null;
    location: string | null;
  } | null;
};

export type ContactDetailResult =
  | { found: false }
  | {
      found: true;
      contact: ContactDetail;
      bookings: ContactBooking[];
      raceRegs: ContactRaceReg[];
      eduRegs: ContactEduReg[];
    };

export async function fetchContactDetail(
  id: string,
): Promise<ContactDetailResult> {
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

  type RaceRow = {
    id: string;
    title: string | null;
    date: string | null;
    location: string | null;
  };
  const racesMap = new Map(
    ((racesData as RaceRow[]) ?? []).map((r) => [r.id, r]),
  );
  const sessionsMap = new Map(
    ((sessionsData as RaceRow[]) ?? []).map((s) => [s.id, s]),
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
  id: string,
  payload: {
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    preferred_language: string;
    newsletter_subscribed: boolean;
  },
): Promise<{ error: string | null }> {
  const { error } = await getAdminClient()
    .database.from("contacts")
    .update(payload)
    .eq("id", id);
  return { error: (error as { message?: string } | null)?.message ?? null };
}

export async function fetchContactRoleCounts(): Promise<{
  leads: number;
  clients: number;
}> {
  const [leadsRes, clientsRes] = await Promise.all([
    getAdminClient()
      .database.from("contacts")
      .select("id", { count: "exact", head: true })
      .or("status.eq.lead,status.is.null"),
    getAdminClient()
      .database.from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("status", "client"),
  ]);

  return {
    leads: (leadsRes as { count: number | null }).count ?? 0,
    clients: (clientsRes as { count: number | null }).count ?? 0,
  };
}
