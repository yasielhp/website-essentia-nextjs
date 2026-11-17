"use server";

import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  ADMIN_ROLES,
  AuthError,
  requireRole,
  type AuthContext,
} from "@/lib/auth-guard";
import type {
  ContactBooking,
  ContactStatus,
  ContactDetail,
  ContactDetailResult,
  ContactMembership,
  ContactRow,
  UpdateContactPayload,
  WhatsAppConsentColumnsRow,
  MarketingConsentResult,
  WhatsAppConsentResult,
} from "@/types/contact";
import { toCampaignPhone } from "@/lib/whatsapp/phone";
import {
  SUPPRESSED_TABLE,
  isPhoneSuppressed,
} from "@/lib/whatsapp/suppression";
import {
  whatsappActivationPatch,
  whatsappConsentColumn,
  type WhatsAppPurpose,
} from "@/lib/whatsapp/consent";
import { applyMarketingConsent } from "@/lib/whatsapp/marketing-consent";
import { setResendSubscription } from "@/lib/newsletter";

/**
 * Contact directory. Every function here reads or writes personal data with the
 * service key, so all of them require a dashboard role — these actions are
 * public HTTP endpoints and previously exposed the whole contact database.
 */

/**
 * A page of contacts, optionally narrowed by status and a name or email search.
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
  search?: string,
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
  // status filter lives here: a contact on page 4 is invisible to a filter that
  // only sees page 1. PostgREST's filter grammar uses commas and parentheses,
  // and `*` would widen the pattern beyond what was typed, so all are stripped.
  // One `or` per word, so "Ana García" finds a first name and a last name.
  const terms = (search ?? "")
    .replace(/[,()*]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  for (const term of terms) {
    query = query.or(
      `email.ilike.*${term}*,first_name.ilike.*${term}*,last_name.ilike.*${term}*`,
    );
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
      "id, first_name, last_name, email, phone, gender, newsletter_subscribed, preferred_language, email_bounced_at, birthdate, newsletter_unsubscribed_at, whatsapp_opted_in_at, whatsapp_marketing_opted_in_at, whatsapp_opted_out_at, whatsapp_unreachable_at",
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

  // Mirrors the columns the bookings list shows, so a contact's table can be
  // the same table minus the client column.
  const bookingFields =
    "id, service_title, duration, date, time, location, location_address, status, payment_status, price_eur, amount_paid_eur, created_by_role, created_at";

  const [
    { data: linkedBookings },
    { data: emailBookings },
    { data: membershipData },
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
    // Memberships carry the person's email, not a contact id.
    contact.email
      ? db
          .from("memberships")
          .select("id, plan, status, start_date, created_at")
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
      { id: string; created_at: string | null; race_id: string }[] | null) ??
    [];
  const eduRows =
    (eduRegData as
      { id: string; created_at: string | null; session_id: string }[] | null) ??
    [];

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
    memberships: (membershipData as ContactMembership[] | null) ?? [],
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

/**
 * Staff recording, on a contact's behalf, that they do or do not take WhatsApp
 * for one purpose: the booking notices or news and offers.
 *
 * The same columns the public booking boxes and a STOP/BAJA reply write, so
 * the dashboard is one more door onto one record. Turning a use on clears the
 * contact's opt-out; if there was one, it also stamps the use with a new date
 * and withdraws the other use, because a STOP is global and a consent from
 * before it must not come back. Turning a use off sets that one date back to
 * NULL and leaves the opt-out alone, which is only ever the contact's own STOP.
 *
 * Takes a uuid and a known purpose and nothing else: both are checked before
 * they reach the database.
 */
export async function setWhatsAppConsent(
  accessToken: string | null,
  contactId: string,
  purpose: Extract<WhatsAppPurpose, "appointments">,
  enabled: boolean,
): Promise<WhatsAppConsentResult> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
  if (
    !z.uuid().safeParse(contactId).success ||
    // "News and offers" is one consent for two channels and goes through
    // `setMarketingConsent`; WhatsApp alone has no marketing switch any more.
    purpose !== "appointments"
  ) {
    return { ok: false, error: "invalid" };
  }

  const column = whatsappConsentColumn(purpose);
  const returned =
    "whatsapp_opted_in_at, whatsapp_marketing_opted_in_at, whatsapp_opted_out_at";
  const db = getAdminClient().database;

  try {
    let patch: Partial<Record<string, string | null>>;
    if (enabled) {
      // The rule lives in `whatsappActivationPatch` and in `upsert_contact`:
      // with a STOP in force this use gets a new date and the other one is
      // withdrawn, so turning one on never revives a consent given before the
      // STOP. Without a STOP the use keeps the date it had.
      const { data: current, error: readError } = await db
        .from("contacts")
        .select(returned)
        .eq("id", contactId)
        .limit(1);
      if (readError) return { ok: false, error: "db" };
      const existing = (current as WhatsAppConsentColumnsRow[] | null)?.[0];
      if (!existing) return { ok: false, error: "notFound" };
      patch = whatsappActivationPatch(
        purpose,
        existing,
        new Date().toISOString(),
      );
    } else {
      patch = { [column]: null };
    }

    const { data, error } = await db
      .from("contacts")
      .update(patch)
      .eq("id", contactId)
      .select(returned);
    if (error) return { ok: false, error: "db" };
    const row = (data as WhatsAppConsentColumnsRow[] | null)?.[0];
    if (!row) return { ok: false, error: "notFound" };
    return { ok: true, ...row };
  } catch {
    return { ok: false, error: "db" };
  }
}

/**
 * Staff recording, on a contact's behalf, that they do or do not take "news and
 * offers": ONE consent for email AND WhatsApp, the same as the single box of
 * the public booking form.
 *
 * Turning it on subscribes the email and consents WhatsApp marketing together,
 * with `whatsappActivationPatch`'s rule for a STOP (a new date, the STOP
 * cleared, the booking-notice consent withdrawn). Turning it off withdraws both
 * and stamps neither the contact's email unsubscribe nor the global STOP: those
 * mean the CONTACT asked, through the link in an email or a BAJA reply. The
 * Resend list follows, best effort and without touching the contact's own
 * columns again.
 *
 * Takes a uuid and a boolean and nothing else; never throws and never returns
 * the database's text.
 */
export async function setMarketingConsent(
  accessToken: string | null,
  contactId: string,
  enabled: boolean,
): Promise<MarketingConsentResult> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
  if (!z.uuid().safeParse(contactId).success || typeof enabled !== "boolean") {
    return { ok: false, error: "invalid" };
  }

  let result: Awaited<ReturnType<typeof applyMarketingConsent>>;
  try {
    result = await applyMarketingConsent(
      getAdminClient().database,
      contactId,
      enabled,
      new Date().toISOString(),
    );
  } catch {
    return { ok: false, error: "db" };
  }
  if (!result.ok) return { ok: false, error: result.error };

  // A contact with no address has no place on the list.
  const email = result.contact.email?.trim().toLowerCase();
  if (email) {
    try {
      await setResendSubscription(email, enabled);
    } catch {
      // fail-open: the list can be put right later; the consent is recorded.
    }
  }
  return { ok: true, ...result.contact };
}

/** How many contacts sit at each point of the lifecycle. */
export async function fetchContactRoleCounts(
  accessToken: string | null,
): Promise<{ leads: number; clients: number; members: number }> {
  const empty = { leads: 0, clients: 0, members: 0 };
  try {
    await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) return empty;
    throw err;
  }

  const db = getAdminClient().database;
  const [leadsRes, clientsRes, membersRes] = await Promise.all([
    db
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .or("status.eq.lead,status.is.null"),
    db
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("status", "client"),
    db
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("status", "member"),
  ]);

  return {
    leads: (leadsRes as { count: number | null }).count ?? 0,
    clients: (clientsRes as { count: number | null }).count ?? 0,
    members: (membersRes as { count: number | null }).count ?? 0,
  };
}

/**
 * Lets a number Meta marked as having no WhatsApp back into campaigns.
 *
 * Meta answers that way when a message cannot be delivered, and the number is
 * left out of every send so it does not cost again. It clears itself when
 * that number writes to the centre; this is for staff who know it works now
 * (a new SIM, a reinstalled app). Takes a uuid and sets one column to NULL.
 */
export async function clearWhatsAppUnreachable(
  accessToken: string | null,
  contactId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
  if (!z.uuid().safeParse(contactId).success) {
    return { ok: false, error: "invalid" };
  }

  try {
    const { data, error } = await getAdminClient()
      .database.from("contacts")
      .update({ whatsapp_unreachable_at: null })
      .eq("id", contactId)
      .select("id");
    if (error) return { ok: false, error: "db" };
    if (!data || (data as unknown[]).length === 0) {
      return { ok: false, error: "notFound" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "db" };
  }
}

// ── The STOP list ───────────────────────────────────────────────

/** What the two actions below answer with when they cannot. Keys the card translates. */
type SuppressionFailure = {
  ok: false;
  error: "unauthenticated" | "forbidden" | "invalid" | "notFound" | "db";
};

/**
 * The administrator and the contact's number, read here: the number is never a
 * parameter, so these actions can only ever act on the number the contact
 * has. `phone` is null when the contact has none that could be written to.
 */
async function suppressionTarget(
  accessToken: string | null,
  contactId: string,
): Promise<{ caller: AuthContext; phone: string | null } | SuppressionFailure> {
  let caller: AuthContext;
  try {
    caller = await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        ok: false,
        error: err.status === 403 ? "forbidden" : "unauthenticated",
      };
    }
    throw err;
  }
  if (!z.uuid().safeParse(contactId).success) {
    return { ok: false, error: "invalid" };
  }
  try {
    const { data, error } = await getAdminClient()
      .database.from("contacts")
      .select("phone")
      .eq("id", contactId)
      .maybeSingle();
    if (error) return { ok: false, error: "db" };
    if (!data) return { ok: false, error: "notFound" };
    return {
      caller,
      phone: toCampaignPhone((data as { phone: string | null }).phone),
    };
  } catch {
    return { ok: false, error: "db" };
  }
}

/**
 * Whether the contact's number is on the list of numbers that wrote STOP, for
 * the card to say so. The list is by number, not by contact: a number may be on
 * it with no opt-out stamped on this contact (the STOP came from a booking
 * somebody else made with it).
 */
export async function fetchWhatsAppSuppression(
  accessToken: string | null,
  contactId: string,
): Promise<{ ok: true; suppressed: boolean } | SuppressionFailure> {
  const target = await suppressionTarget(accessToken, contactId);
  if ("ok" in target) return target;
  if (!target.phone) return { ok: true, suppressed: false };
  try {
    return {
      ok: true,
      suppressed: await isPhoneSuppressed(
        getAdminClient().database,
        target.phone,
      ),
    };
  } catch {
    // The list cannot be read (its table is created by a migration).
    return { ok: false, error: "db" };
  }
}

/**
 * Takes the contact's number off the STOP list, for staff who know the person
 * asked to hear from the centre again. The ONLY way a number leaves it: no
 * checkbox, toggle or contact upsert does. It removes the contact's own number
 * and nothing else, and does not touch the contact's consent.
 */
export async function clearWhatsAppSuppression(
  accessToken: string | null,
  contactId: string,
): Promise<{ ok: true; removed: boolean } | SuppressionFailure> {
  const target = await suppressionTarget(accessToken, contactId);
  if ("ok" in target) return target;
  if (!target.phone) return { ok: true, removed: false };
  try {
    const { data, error } = await getAdminClient()
      .database.from(SUPPRESSED_TABLE)
      .delete()
      .eq("phone", target.phone)
      .select("phone");
    if (error) return { ok: false, error: "db" };
    const removed = ((data ?? []) as unknown[]).length > 0;
    // Who and which contact, never the number.
    console.info("[contacts] whatsapp suppression cleared", {
      admin: target.caller.userId,
      contact: contactId,
      removed,
    });
    return { ok: true, removed };
  } catch {
    return { ok: false, error: "db" };
  }
}
