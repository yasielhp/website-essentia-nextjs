"use client";

import { insforge } from "@/lib/insforge";
import { loadColorSettings, DEFAULT_COLORS } from "@/utils/color-settings";
import { toYMD, getWeekDays } from "@/utils/dashboard-calendar";
import type { CalendarView, CalendarEvent } from "@/types/calendar";
import type { CalendarFilters } from "@/utils/calendar-filters";

/**
 * Everything the dashboard calendar draws, gathered and coloured.
 *
 * Three kinds of thing land on the same grid — bookings, races and education
 * sessions — and the bookings need two more lookups before they can be shown:
 * the session type for their colour and the professional for their tooltip.
 */

type Row = Record<string, unknown>;

/** The wording the tooltip needs, resolved by the caller who has the locale. */
export type EventLabels = {
  bookingFallback: string;
  staff: string;
  noStaff: string;
};

/** The span the chosen view covers, as two `YYYY-MM-DD`. */
function rangeFor(view: CalendarView, anchor: Date): [string, string] {
  if (view === "month") {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    return [
      `${y}-${String(m + 1).padStart(2, "0")}-01`,
      toYMD(new Date(y, m + 1, 0)),
    ];
  }
  if (view === "week") {
    const days = getWeekDays(anchor);
    return [toYMD(days[0]!), toYMD(days[6]!)];
  }
  const day = toYMD(anchor);
  return [day, day];
}

/**
 * The colour and the label of each booking's session type.
 *
 * The calendar is read by colour, and a whole service in one colour says
 * nothing: every booking of Terapias Manuales looked alike. Colour comes from
 * the session type, which is unique per treatment, and only falls back to the
 * service when a booking has no type.
 */
async function tierLookup(bookings: Row[]) {
  const colors = new Map<string, string>();
  const labels = new Map<string, string>();
  const ids = [
    ...new Set(
      bookings
        .map((b) => b.tier_id as string | null)
        .filter((id): id is string => !!id),
    ),
  ];
  if (ids.length === 0) return { colors, labels };

  const { data } = await insforge.database
    .from("service_tiers")
    .select("id, label, color")
    .in("id", ids);

  for (const row of (data ?? []) as {
    id: string;
    label: string | null;
    color: string | null;
  }[]) {
    if (row.color) colors.set(row.id, row.color);
    if (row.label) labels.set(row.id, row.label);
  }
  return { colors, labels };
}

async function staffLookup(bookings: Row[]) {
  const names = new Map<string, string>();
  const ids = [
    ...new Set(
      bookings
        .map((b) => b.staff_id as string | null)
        .filter((id): id is string => !!id),
    ),
  ];
  if (ids.length === 0) return names;

  const { data } = await insforge.database
    .from("profiles")
    .select("id, full_name, first_name")
    .in("id", ids);

  for (const row of (data ?? []) as {
    id: string;
    full_name: string | null;
    first_name: string | null;
  }[]) {
    names.set(row.id, row.full_name ?? row.first_name ?? "—");
  }
  return names;
}

export async function loadCalendarEvents({
  view,
  anchor,
  isPartner,
  userId,
  filters,
  labels,
}: {
  view: CalendarView;
  anchor: Date;
  isPartner: boolean;
  userId: string | undefined;
  filters: CalendarFilters;
  labels: EventLabels;
}): Promise<CalendarEvent[]> {
  const settings = loadColorSettings();
  const [fromDate, toDate] = rangeFor(view, anchor);
  const toDateEnd = `${toDate}T23:59:59.999`;

  let bookingsQuery = insforge.database
    .from("bookings")
    .select(
      "id, date, time, service_id, service_title, tier_id, staff_id, duration, status, first_name, last_name",
    )
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("time", { ascending: true });

  // A partner sees their own bookings and nothing else — not even a grey block
  // where somebody else's sits. The hours those occupy are refused by
  // `fetchAvailability` when a booking is made, which reads every booking that
  // professional has whoever entered it, so an empty square here is not an
  // offer.
  if (isPartner && userId)
    bookingsQuery = bookingsQuery.eq("partner_id", userId);

  if (filters.staffId)
    bookingsQuery = bookingsQuery.eq("staff_id", filters.staffId);
  if (filters.serviceId)
    bookingsQuery = bookingsQuery.eq("service_id", filters.serviceId);
  if (filters.tierId)
    bookingsQuery = bookingsQuery.eq("tier_id", filters.tierId);

  // Races, sessions and calendar holes are not bookings, so no filter can
  // describe them: with one set, only the matching bookings are drawn.
  const filtering = !!(filters.staffId || filters.serviceId || filters.tierId);

  const { data: bookingRows } = await bookingsQuery;

  const [racesRes, sessionsRes] =
    isPartner || filtering
      ? [{ data: null }, { data: null }]
      : await Promise.all([
          insforge.database
            .from("races")
            .select("id, title, date, location")
            .gte("date", fromDate)
            .lte("date", toDateEnd),
          insforge.database
            .from("education_sessions")
            .select("id, title, date, location, speaker")
            .gte("date", fromDate)
            .lte("date", toDateEnd),
        ]);

  const bookings = (bookingRows ?? []) as Row[];
  const [{ colors: tierColors, labels: tierLabels }, staffNames] =
    await Promise.all([tierLookup(bookings), staffLookup(bookings)]);

  const events: CalendarEvent[] = [];

  for (const b of bookings) {
    const serviceId = b.service_id as string | null;
    const tierId = b.tier_id as string | null;
    const color =
      (tierId && tierColors.get(tierId)) ||
      (serviceId && settings.services[serviceId]) ||
      (serviceId && DEFAULT_COLORS.services[serviceId]) ||
      "#64748b";
    const name =
      [b.first_name, b.last_name].filter(Boolean).join(" ") ||
      (b.service_title as string) ||
      labels.bookingFallback;
    const staffId = b.staff_id as string | null;
    // A pill only has room for a name; the rest goes in the hover card.
    const tooltip = [
      [b.time as string | null, b.duration as string | null]
        .filter(Boolean)
        .join(" · "),
      name,
      [b.service_title as string | null, tierId ? tierLabels.get(tierId) : null]
        .filter(Boolean)
        .join(" · "),
      staffId
        ? `${labels.staff}: ${staffNames.get(staffId) ?? "—"}`
        : labels.noStaff,
    ]
      .filter(Boolean)
      .join("\n");

    events.push({
      id: b.id as string,
      date: (b.date as string).slice(0, 10),
      time: b.time as string | null,
      title: name,
      // The treatment is what tells one booking from another; the service is
      // the same for a dozen of them.
      subtitle:
        (tierId ? tierLabels.get(tierId) : null) ??
        (b.service_title as string | undefined),
      tooltip,
      status: (b.status as string | null) ?? undefined,
      color,
      href: `/dashboard/bookings/${b.id}`,
      type: "booking",
    });
  }

  for (const r of (racesRes?.data ?? []) as Row[]) {
    events.push({
      id: r.id as string,
      date: (r.date as string).slice(0, 10),
      time: null,
      title: r.title as string,
      subtitle: r.location as string | undefined,
      color: settings.races,
      href: `/dashboard/races/${r.id}/edit`,
      type: "race",
    });
  }

  for (const s of (sessionsRes?.data ?? []) as Row[]) {
    // A session stored at midnight UTC has no hour of its own; it is an
    // all-day entry rather than one at 00:00.
    const d = new Date(s.date as string);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const time =
      h === 0 && m === 0
        ? null
        : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    events.push({
      id: s.id as string,
      date: (s.date as string).slice(0, 10),
      time,
      title: s.title as string,
      subtitle:
        (s.speaker as string | null) ??
        (s.location as string | null) ??
        undefined,
      color: settings.sessions,
      href: `/dashboard/education/${s.id}/edit`,
      type: "session",
    });
  }

  return events;
}
