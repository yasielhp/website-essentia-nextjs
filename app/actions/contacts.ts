"use server";

import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { contactAccess } from "@/lib/bookings/booking-access";
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
    // The list of every contact is not a partner's: her screens show her own
    // bookings, and a client of hers from one of them (`fetchContactDetail`).
    await requireRole(accessToken, ["admin", "staff"]);
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
  let actor;
  try {
    actor = await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { found: false };
    throw err;
  }
  // A partner sees a contact only when it is a client of hers, and then only
  // her own bookings with it (below); not found otherwise.
  if (!(await contactAccess(actor, id))) return { found: false };
  const partnerId = actor.role === "partner" ? actor.userId : null;

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
    partnerId
      ? db
          .from("bookings")
          .select(bookingFields)
          .eq("contact_id", id)
          .eq("partner_id", partnerId)
          .order("created_at", { ascending: false })
      : db
          .from("bookings")
          .select(bookingFields)
          .eq("contact_id", id)
          .order("created_at", { ascending: false }),
    // Two queries merged by id rather than one `or(...)`: an address embedded
    // in PostgREST filter syntax would need escaping, and getting that wrong
    // silently changes which rows match.
    contact.email
      ? partnerId
        ? db
            .from("bookings")
            .select(bookingFields)
            .ilike("email", contact.email)
            .eq("partner_id", partnerId)
            .order("created_at", { ascending: false })
        : db
            .from("bookings")
            .select(bookingFields)
            .ilike("email", contact.email)
            .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Memberships carry the person's email, not a contact id. Not a
    // partner's to see, nor the registrations below.
    contact.email && !partnerId
      ? db
          .from("memberships")
          .select("id, plan, status, start_date, created_at")
          .ilike("email", contact.email)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    partnerId
      ? Promise.resolve({ data: [] })
      : db
          .from("race_registrations")
          .select("id, created_at, race_id")
          .eq("contact_id", id)
          .order("created_at", { ascending: false }),
    partnerId
      ? Promise.resolve({ data: [] })
      : db
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

/**
 * The details form of the contact page, and nothing else.
 *
 * STRICT on purpose: this action writes with the service key, which no policy
 * holds back, and it used to hand the caller's object straight to `.update()`.
 * Any dashboard role could then write any column of a contact
 * (`whatsapp_opted_out_at: null`, a consent date, the unsubscribe token) and
 * walk around every rule the consent actions below keep. An unknown key is a
 * refusal of the whole save, not a key quietly dropped. The fields are exactly
 * the ones `/dashboard/contacts/<id>` sends; a new field of that form is added
 * here too.
 *
 * Not exported: a `"use server"` module exports async functions only.
 */
const contactDetailsInput = z.strictObject({
  first_name: z.string().trim().min(1).max(200),
  last_name: z.string().trim().max(200).nullable(),
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()).nullable(),
  phone: z.string().trim().min(1).max(40).nullable(),
  gender: z.enum(["female", "male", "other"]).nullable(),
  preferred_language: z.enum(["en", "es"]),
  birthdate: z.iso.date().nullable(),
}) satisfies z.ZodType<UpdateContactPayload>;

/**
 * What the page shows when a save fails. It prints the string as it comes, so
 * these are sentences, and never the database's: its text names columns and
 * constraints and belongs in the server log.
 */
const CONTACT_SAVE_INVALID = "The contact details are not valid.";
const CONTACT_SAVE_FAILED = "The contact could not be saved.";
const CONTACT_EMAIL_TAKEN = "Another contact already has this email address.";

/** Postgres' code for a unique constraint: here, the contact's email. */
const UNIQUE_VIOLATION = "23505";

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

  const contactId = z.uuid().safeParse(id);
  const details = contactDetailsInput.safeParse(payload);
  if (!contactId.success || !details.success) {
    return { error: CONTACT_SAVE_INVALID };
  }

  try {
    const { error } = await getAdminClient()
      .database.from("contacts")
      .update(details.data)
      .eq("id", contactId.data);
    if (!error) return { error: null };
    console.error("[contacts] could not update the contact:", error);
    return {
      error:
        (error as { code?: string }).code === UNIQUE_VIOLATION
          ? CONTACT_EMAIL_TAKEN
          : CONTACT_SAVE_FAILED,
    };
  } catch (err) {
    console.error("[contacts] could not update the contact:", err);
    return { error: CONTACT_SAVE_FAILED };
  }
}

/**
 * A minimal trail of who changed a consent, until consents have a table of
 * their own: the staff member, the contact, the use and the direction. Never an
 * email or a phone. A persistent record (who, when, from where) is the real fix
 * and is noted in the findings.
 */
function logConsentChange(
  actor: string,
  contactId: string,
  use: "appointments" | "marketing",
  enabled: boolean,
  extra: Record<string, unknown> = {},
): void {
  console.info("[contacts] consent changed", {
    actor,
    contact: contactId,
    use,
    action: enabled ? "on" : "off",
    ...extra,
  });
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
  let actor: string;
  try {
    actor = (await requireRole(accessToken)).userId;
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
    logConsentChange(actor, contactId, purpose, enabled);
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
  let actor: string;
  try {
    actor = (await requireRole(accessToken)).userId;
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

  // A contact with no address has no place on the list, so there is nothing to
  // be out of step. A list that fails does not undo the consent; it is reported
  // so the page can say so, above all when the consent was withdrawn.
  const email = result.contact.email?.trim().toLowerCase();
  let emailListSynced = true;
  if (email) {
    try {
      emailListSynced = (await setResendSubscription(email, enabled)).ok;
    } catch {
      emailListSynced = false;
    }
  }
  logConsentChange(actor, contactId, "marketing", enabled, { emailListSynced });
  return { ok: true, emailListSynced, ...result.contact };
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
