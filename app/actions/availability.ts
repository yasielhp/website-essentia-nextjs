"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { getScheduledStartTimes } from "@/utils/calendar-helpers";
import { parseDurationMinutes } from "@/utils/format";
import type { WeeklySchedule } from "@/types/schedule";
import { getFreeBusy, getStaffAccessToken } from "@/lib/google-calendar";

/** Available start times per date, keyed by `YYYY-MM-DD`. */
export type Availability = Record<string, string[]>;

type Busy = { start: number; end: number };

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
  const addBusy = (staffId: string, day: string, range: Busy) => {
    const key = `${staffId}|${day}`;
    busy.set(key, [...(busy.get(key) ?? []), range]);
  };

  for (const b of (bookings ?? []) as BookingRow[]) {
    if (!b.staff_id || !b.date || !b.time) continue;
    const start = toMinutes(b.time);
    addBusy(b.staff_id, b.date.slice(0, 10), {
      start,
      end: start + parseDurationMinutes(b.duration),
    });
  }

  /**
   * And whatever their own Google Calendar says they are doing.
   *
   * This was the gap: availability was built from the working schedule and
   * from Essentia's own bookings, and nothing else. A professional who blocked
   * tomorrow in their calendar — a holiday, a doctor's appointment, a day off
   * — was still offered to the public for the whole day, because the site
   * never asked.
   *
   * The tokens are read from the profile, which is where connecting a calendar
   * from the dashboard puts them. `staff_services` holds a per-service copy
   * from an older flow; `getStaffAccessToken` prefers the profile and both end
   * up on the same calendar.
   */
  await Promise.all(
    staff.map(async (person) => {
      try {
        const token = await getStaffAccessToken(person.id);
        if (!token) return;

        const intervals = await getFreeBusy(
          token,
          "primary",
          from,
          `${to}T23:59:59Z`,
        );

        for (const interval of intervals) {
          // An interval can span days — an all-day block is one of them — so
          // it is cut at midnight and each day gets the part that is its own.
          const start = new Date(interval.start);
          const end = new Date(interval.end);
          const cursorDay = new Date(start);
          cursorDay.setHours(0, 0, 0, 0);

          while (cursorDay < end) {
            const dayKey = toKey(cursorDay);
            const dayStart = new Date(cursorDay);
            const dayEnd = new Date(cursorDay);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const from0 = start > dayStart ? start : dayStart;
            const to0 = end < dayEnd ? end : dayEnd;

            addBusy(person.id, dayKey, {
              start: from0.getHours() * 60 + from0.getMinutes(),
              end:
                to0.getTime() === dayEnd.getTime()
                  ? 24 * 60
                  : to0.getHours() * 60 + to0.getMinutes(),
            });

            cursorDay.setDate(cursorDay.getDate() + 1);
          }
        }
      } catch {
        // Fail open: Google being unreachable must not close the calendar.
      }
    }),
  );

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
