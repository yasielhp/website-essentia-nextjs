import type { CalendarView, CalendarEvent } from "@/types/calendar";

/**
 * Month and weekday names come from `Intl` rather than a hardcoded English
 * list, so adding a locale needs no change here. Callers pass the locale down
 * — this module has no access to the next-intl runtime.
 */
const weekdayCache = new Map<string, string[]>();

/** Short weekday names, Monday first. */
export function getShortWeekdays(locale: string): string[] {
  const cached = weekdayCache.get(locale);
  if (cached) return cached;

  const format = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2024-01-01 was a Monday.
  const days = Array.from({ length: 7 }, (_, i) =>
    format.format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
  weekdayCache.set(locale, days);
  return days;
}

export function toYMD(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
/**
 * A day that already went by. The overview calendar turns every empty cell
 * into "create a booking here", which made it possible to book last month.
 */
export function isPastDay(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day.getTime() < today.getTime();
}

/** Same idea one level down: an `HH:MM` slot on `day` that already went by. */
export function isPastSlot(day: Date, time: string): boolean {
  if (isPastDay(day)) return true;
  const now = new Date();
  if (toYMD(day) !== toYMD(now)) return false;

  const [hours, minutes] = time.split(":").map(Number);
  const slot = new Date(day);
  slot.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return slot.getTime() < now.getTime();
}

export function getCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // 0 = Mon
  const days: Date[] = [];
  for (let i = startDow; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  let next = 1;
  while (days.length < 42) {
    days.push(new Date(year, month + 1, next++));
  }
  return days;
}

export function getWeekDays(anchor: Date): Date[] {
  const dow = (anchor.getDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function groupByDate(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return map;
}

export function sortByTime(events: CalendarEvent[]): CalendarEvent[] {
  return events.toSorted((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

export function formatPeriod(
  view: CalendarView,
  anchor: Date,
  locale: string,
): string {
  if (view === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(anchor);
  }

  if (view === "week") {
    const days = getWeekDays(anchor);
    // formatRange collapses the shared month/year on its own, in each locale's
    // own idiom — no need to compare months by hand.
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).formatRange(days[0]!, days[6]!);
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(anchor);
}

export function navigateAnchor(
  view: CalendarView,
  anchor: Date,
  dir: 1 | -1,
): Date {
  const d = new Date(anchor);
  if (view === "month") {
    d.setDate(1);
    d.setMonth(d.getMonth() + dir);
  } else if (view === "week") {
    d.setDate(d.getDate() + 7 * dir);
  } else {
    d.setDate(d.getDate() + dir);
  }
  return d;
}
