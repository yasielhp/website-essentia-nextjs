"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { getScheduledStartTimes } from "@/utils/calendar-helpers";
import { parseDurationMinutes } from "@/utils/format";
import type { WeeklySchedule } from "@/types/schedule";

/** Available start times per date, keyed by `YYYY-MM-DD`. */
export type Availability = Record<string, string[]>;

type StaffRow = {
  id: string;
  schedule: WeeklySchedule | null;
  slot_interval_minutes: number | null;
};

type BookingRow = {
  staff_id: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * When a session type can actually be booked.
 *
 * Two things decide it, and only these two: who is assigned to the treatment,
 * and the days and hours those people work. Assign only Yuli and give her
 * Mondays and Tuesdays, and the rest of the week is not offered — before this,
 * availability was one hardcoded 08:00–19:00 list, identical for every
 * treatment on every day of the year.
 *
 * Google Calendar plays no part here. It receives the bookings we confirm; it
 * does not decide which hours exist. What removes an hour is another booking
 * of the same person, held in our own tables.
 *
 * A slot survives when at least one assigned person is both working and free,
 * so the union — not the intersection — is what gets returned. `staffId`
 * narrows it to one person once the visitor has picked.
 */
export async function fetchAvailability({
  tierId,
  staffId,
  from,
  to,
  durationMinutes,
}: {
  tierId: string;
  staffId?: string | null;
  /** Inclusive range, `YYYY-MM-DD`. */
  from: string;
  to: string;
  durationMinutes: number;
}): Promise<Availability> {
  if (!tierId || !from || !to) return {};

  const db = getAdminClient().database;

  const { data: assigned } = await db
    .from("staff_tiers")
    .select("staff_id")
    .eq("tier_id", tierId);

  let ids = ((assigned ?? []) as { staff_id: string }[]).map((r) => r.staff_id);
  if (staffId) ids = ids.filter((id) => id === staffId);
  // Nobody assigned means nobody can perform it, so there is nothing to offer.
  if (ids.length === 0) return {};

  const [{ data: people }, { data: bookings }] = await Promise.all([
    db
      .from("profiles")
      .select("id, schedule, slot_interval_minutes")
      .in("id", ids)
      .eq("role", "staff"),
    db
      .from("bookings")
      .select("staff_id, date, time, duration")
      .in("staff_id", ids)
      .gte("date", from)
      .lte("date", to)
      .neq("status", "cancelled"),
  ]);

  const staff = ((people ?? []) as StaffRow[]).filter((p) => p.schedule);
  if (staff.length === 0) return {};

  // Their existing bookings, as busy minute ranges per person per day.
  const busy = new Map<string, { start: number; end: number }[]>();
  for (const b of (bookings ?? []) as BookingRow[]) {
    if (!b.staff_id || !b.date || !b.time) continue;
    const start = toMinutes(b.time);
    const key = `${b.staff_id}|${b.date.slice(0, 10)}`;
    const list = busy.get(key) ?? [];
    list.push({ start, end: start + parseDurationMinutes(b.duration) });
    busy.set(key, list);
  }

  const availability: Availability = {};
  const now = new Date();
  const cursor = new Date(`${from}T00:00:00`);
  const last = new Date(`${to}T00:00:00`);

  while (cursor <= last) {
    const key = toKey(cursor);
    const times = new Set<string>();

    for (const person of staff) {
      const starts = getScheduledStartTimes(cursor, durationMinutes, [
        {
          schedule: person.schedule!,
          slotIntervalMinutes: person.slot_interval_minutes ?? 30,
        },
      ]);
      const taken = busy.get(`${person.id}|${key}`) ?? [];

      for (const time of starts) {
        const start = toMinutes(time);
        const end = start + durationMinutes;
        const overlaps = taken.some((b) => start < b.end && end > b.start);
        if (!overlaps) times.add(time);
      }
    }

    // An hour that has already passed today is not on offer.
    const isToday = key === toKey(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const usable = [...times]
      .filter((time) => !isToday || toMinutes(time) > nowMinutes)
      .sort();

    if (usable.length > 0) availability[key] = usable;
    cursor.setDate(cursor.getDate() + 1);
  }

  return availability;
}
