import { getAdminClient } from "@/lib/insforge-admin";
import { readAllPages } from "./paged-read";
import { loadAllSuppressedPhones } from "@/lib/whatsapp/suppression";
import type {
  CampaignAudience,
  CampaignChannel,
  ConsentPurpose,
} from "@/types/campaign";
import {
  foldAppointments,
  foldVisits,
  type AppointmentBooking,
} from "./visits";
import {
  filterAudience,
  type ContactCandidate,
  type Recipient,
} from "./audience-filter";

/**
 * Resolves a campaign audience against the live tables.
 *
 * Two plain reads and an in-memory filter, not a query built from the
 * conditions: the centre has a few hundred contacts and bookings, so pulling
 * both tables costs less than one round trip per condition, the SDK has no
 * dynamic SQL to express "any of these services" or "last booking older
 * than", and every rule lives in `audience-filter.ts` where it is tested. If
 * the tables ever outgrow this, the same signature can sit over an RPC that
 * does the fold in Postgres.
 *
 * Bookings are matched to contacts by `contact_id` and, failing that, by
 * email: bookings created from the dashboard never set a `contact_id` (81 of
 * the first 100 rows carried none), so keying on it alone would call most
 * clients "never booked".
 *
 * SERVER ONLY: reads through the admin client.
 */

type ContactRow = {
  id: string;
  /** Nullable in the live table: a WhatsApp-only contact has none. */
  email: string | null;
  first_name: string | null;
  preferred_language: string | null;
  newsletter_subscribed: boolean | null;
  email_bounced_at: string | null;
  newsletter_unsubscribed_at: string | null;
  newsletter_subscribed_at: string | null;
  birthdate: string | null;
  last_name: string | null;
  phone: string | null;
  whatsapp_marketing_opted_in_at: string | null;
  whatsapp_opted_in_at: string | null;
  whatsapp_opted_out_at: string | null;
  whatsapp_unreachable_at: string | null;
};

type BookingRow = {
  id: string;
  contact_id: string | null;
  email: string | null;
  service_id: string | null;
  service_title: string | null;
  tier_id: string | null;
  /** Nullable in the live table: some imported rows carry no date. */
  date: string | null;
  time: string | null;
  duration: string | null;
  status: string | null;
};

type BookingSummary = {
  last: string | null;
  first: string | null;
  services: Set<string>;
  count: number;
  confirmedCount: number;
  /** Every booking of the contact, for `foldVisits` to choose among. */
  bookings: AppointmentBooking[];
};

/** What a campaign being resolved is for, beyond its audience conditions. */
export type AudienceOptions = {
  /**
   * The consent the contacts must have (WhatsApp only). An appointment notice
   * is transactional: the consent to notices about her own appointment, never
   * the one to news. Marketing when absent.
   */
  purpose?: ConsentPurpose;
  /**
   * Load each contact's confirmed and completed bookings as appointments, for
   * the notices that count hours around them. Nothing else reads them.
   */
  appointments?: boolean;
};

export async function resolveAudience(
  audience: CampaignAudience,
  now = new Date(),
  channel: CampaignChannel = "email",
  options: AudienceOptions = {},
): Promise<Recipient[]> {
  // The numbers that wrote STOP, for WhatsApp only. A list that cannot be read
  // throws (it fails closed: an audience that cannot be filtered is not
  // resolved), and email never touches it.
  const suppressed =
    channel === "whatsapp"
      ? await loadAllSuppressedPhones(getAdminClient().database)
      : undefined;
  return filterAudience(
    await loadCandidates(channel, {
      appointments: options.appointments,
      now,
    }),
    audience,
    now,
    channel,
    suppressed,
    options.purpose,
  );
}

/**
 * Every contact with its booking history folded in, ready for the filter.
 * Separate from `resolveAudience` so a screen that counts several segments
 * at once reads the tables once, not once per segment.
 *
 * The channel only decides which contacts can possibly qualify: the email
 * channel needs an address, WhatsApp needs a phone and may have no email.
 */
/**
 * How far back an appointment notice reads bookings: the longest notice
 * (`after_visit`, 720 hours = 30 days, plus its 3-hour bound) and a margin.
 * Anything older cannot be due, and the table only grows.
 */
const APPOINTMENT_LOOKBACK_DAYS = 31;

/**
 * Narrows the bookings read for an appointment notice to the last
 * `APPOINTMENT_LOOKBACK_DAYS` and what is ahead, in a fixed order. For every
 * other resolution the query is the one it always was, untouched.
 *
 * Booking-history conditions of the audience (never booked, last booking…)
 * therefore see only that span on an appointment notice; they have no meaning
 * for one.
 */
function appointmentBookings<
  Q extends {
    gte: (column: string, value: string) => Q;
    order: (column: string, options: { ascending: boolean }) => Q;
  },
>(query: Q, appointments: boolean, now: Date): Q {
  // Read page by page, so the order must be total: the id settles it.
  if (!appointments) return query.order("id", { ascending: true });
  const since = new Date(now.getTime() - APPOINTMENT_LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return query
    .gte("date", since)
    .order("date", { ascending: true })
    .order("id", { ascending: true });
}

export async function loadCandidates(
  /**
   * `any` is for the screen where a segment is made: everyone with an address
   * OR a phone, since a segment serves both channels. A send always names one.
   */
  channel: CampaignChannel | "any" = "email",
  options: Pick<AudienceOptions, "appointments"> & { now?: Date } = {},
): Promise<ContactCandidate[]> {
  const db = getAdminClient().database;

  // Each page is a fresh query: the database never gives more than a thousand
  // rows at once, and `readAllPages` goes on until the table ends (or fails the
  // whole read: a list that is only part of the contacts is worse than none).
  const readContacts = (from: number, to: number) => {
    const base = db
      .from("contacts")
      .select(
        "id, email, first_name, last_name, phone, preferred_language, newsletter_subscribed, email_bounced_at, newsletter_unsubscribed_at, newsletter_subscribed_at, birthdate, whatsapp_marketing_opted_in_at, whatsapp_opted_in_at, whatsapp_opted_out_at, whatsapp_unreachable_at",
      );
    return (
      (
        channel === "any"
          ? base.or("email.not.is.null,phone.not.is.null")
          : base.not(channel === "whatsapp" ? "phone" : "email", "is", null)
      )
        // A fixed order, so the contact kept when two share a phone (the first)
        // is the same in the preview and in the send, and so the pages join up.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    );
  };
  const readBookings = (from: number, to: number) =>
    appointmentBookings(
      db
        .from("bookings")
        .select(
          "id, contact_id, email, service_id, service_title, tier_id, date, time, duration, status",
        )
        .neq("status", "cancelled"),
      options.appointments === true,
      options.now ?? new Date(),
    ).range(from, to);

  const [contactRows, bookingRows, tiersResult] = await Promise.all([
    readAllPages<ContactRow>("[resolveAudience] contacts", readContacts),
    readAllPages<BookingRow>("[resolveAudience] bookings", readBookings),
    // A handful of rows: read apart rather than embedded, so it does not
    // depend on the foreign key being declared.
    db.from("service_tiers").select("id, label"),
  ]);

  // A label is a nicety for the message: if the read failed, the send goes
  // out without it rather than not at all.
  if (tiersResult.error) {
    console.error(
      `[loadCandidates] service_tiers read failed: ${tiersResult.error.message}`,
    );
  }
  const tierLabels = new Map<string, string>();
  for (const tier of (tiersResult.data ?? []) as {
    id: string;
    label: string | null;
  }[]) {
    if (tier.label) tierLabels.set(tier.id, tier.label);
  }

  const contacts = contactRows;

  // Contact emails are stored lowercased; booking emails are typed by hand,
  // so the booking side is normalised before the lookup.
  const contactIdByEmail = new Map<string, string>();
  for (const row of contacts) {
    if (!row.email) continue;
    const email = row.email.trim().toLowerCase();
    if (!contactIdByEmail.has(email)) contactIdByEmail.set(email, row.id);
  }

  // One pass over bookings, keyed by contact: the latest date, the set of
  // services ever booked, and how many bookings count towards "never booked".
  // Each booking resolves to at most one contact, so a row carrying both a
  // matching id and email is counted once.
  const byContact = new Map<string, BookingSummary>();
  for (const booking of bookingRows) {
    const contactId =
      booking.contact_id ??
      (booking.email
        ? contactIdByEmail.get(booking.email.trim().toLowerCase())
        : undefined);
    if (!contactId) continue;

    const summary = byContact.get(contactId) ?? {
      last: null,
      first: null,
      services: new Set<string>(),
      count: 0,
      confirmedCount: 0,
      bookings: [],
    };
    // A booking without a date still proves the contact booked, and which
    // service, but cannot be "the last one". `date` is a Postgres date, but
    // sliced anyway so a timestamp would still compare as YYYY-MM-DD, which
    // sorts lexically as it does chronologically.
    if (booking.date) {
      const day = booking.date.slice(0, 10);
      if (summary.last === null || day > summary.last) summary.last = day;
      if (summary.first === null || day < summary.first) summary.first = day;
    }
    if (booking.status === "confirmed" || booking.status === "completed") {
      summary.confirmedCount += 1;
    }
    summary.bookings.push(booking);
    if (booking.service_id) summary.services.add(booking.service_id);
    summary.count += 1;
    byContact.set(contactId, summary);
  }

  const candidates: ContactCandidate[] = contacts.map((row) => {
    const bookings = byContact.get(row.id);
    const visits = foldVisits(bookings?.bookings ?? [], tierLabels);
    return {
      id: row.id,
      email: row.email ?? "",
      firstName: row.first_name ?? "",
      language: row.preferred_language,
      newsletter: row.newsletter_subscribed === true,
      bouncedAt: row.email_bounced_at,
      unsubscribedAt: row.newsletter_unsubscribed_at,
      lastBookingDate: bookings?.last ?? null,
      firstBookingDate: bookings?.first ?? null,
      subscribedAt: row.newsletter_subscribed_at,
      birthdate: row.birthdate,
      lastName: row.last_name,
      phone: row.phone,
      serviceIds: bookings ? [...bookings.services] : [],
      bookingsCount: bookings?.count ?? 0,
      firstVisitEndsAt: visits.firstVisitEndsAt,
      firstVisitEndsAtByTier: visits.firstVisitEndsAtByTier,
      confirmedBookingsCount: bookings?.confirmedCount ?? 0,
      lastVisit: visits.lastVisit,
      firstVisit: visits.firstVisit,
      firstVisitByTier: visits.firstVisitByTier,
      ...(options.appointments
        ? {
            appointments: foldAppointments(
              bookings?.bookings ?? [],
              tierLabels,
            ),
          }
        : {}),
      whatsappMarketingOptedInAt: row.whatsapp_marketing_opted_in_at,
      whatsappOptedInAt: row.whatsapp_opted_in_at,
      whatsappOptedOutAt: row.whatsapp_opted_out_at,
      whatsappUnreachableAt: row.whatsapp_unreachable_at,
    };
  });

  return candidates;
}
