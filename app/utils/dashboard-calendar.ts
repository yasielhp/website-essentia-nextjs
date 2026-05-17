import type { CalendarView, CalendarEvent } from "@/types/calendar";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function toYMD(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
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

export function formatPeriod(view: CalendarView, anchor: Date): string {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  if (view === "month") return `${MONTHS[m]} ${y}`;
  if (view === "week") {
    const days = getWeekDays(anchor);
    const s = days[0]!;
    const e = days[6]!;
    if (s.getMonth() === e.getMonth())
      return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${y}`;
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${y}`;
  }
  return anchor.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

export function formatUpcomingDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
