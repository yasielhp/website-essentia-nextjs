import { dateFormatter } from "@/utils/intl";
import type { WeeklySchedule } from "@/types/schedule";

/** One person's working week, as the availability helpers need it. */
export type StaffSchedule = {
  schedule: WeeklySchedule;
  slotIntervalMinutes: number;
};

export const MONTH_NAMES = [
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

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The booking flow's steps.
 *
 * Date and time used to be dropped when the service had no Google Calendar
 * connected, which left the visitor confirming a booking with no hour on it.
 * Availability comes from the assigned staff's own schedule now; a calendar
 * only removes the hours they are already busy, so the step always belongs.
 */
export function buildSteps() {
  return [
    { id: "service", label: "Service" },
    { id: "duration", label: "Session type" },
    { id: "details", label: "Your details" },
    { id: "datetime", label: "Date & time" },
    { id: "confirm", label: "Confirm" },
  ];
}

export function getLocalizedMonthName(
  locale: string,
  year: number,
  month: number,
): string {
  return dateFormatter(locale, { month: "long" }).format(
    new Date(year, month, 1),
  );
}

export function getLocalizedDayNames(locale: string): string[] {
  // Jan 6 2025 is a Monday — use Mon–Sun as base week
  const formatter = dateFormatter(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(2025, 0, 6 + i)),
  );
}

export function isAvailableDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d <= today) return false;
  const max = new Date(today);
  max.setDate(today.getDate() + 60);
  if (d > max) return false;
  return true;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getCalendarDays(year: number, month: number): Date[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  return days;
}

/**
 * Which of the seven columns the 1st of the month falls in, Monday first.
 *
 * The month used to be padded with `null`s so the first day landed in the right
 * place. Those blanks were rendered as empty cells with nothing to key them by
 * but their position, and a key that is a position is the one thing React
 * cannot use when a list changes. CSS can start the grid wherever it likes, so
 * the blanks are gone and the days are the only cells left.
 */
export function getCalendarStartColumn(year: number, month: number): number {
  const firstDow = new Date(year, month, 1).getDay();
  return (firstDow === 0 ? 6 : firstDow - 1) + 1;
}

const OPENING_MINUTES = 8 * 60; // 08:00 — first bookable slot
const LAST_SLOT_MINUTES = 17 * 60; // 17:00 — last bookable slot
const CLOSING_MINUTES = 19 * 60; // 19:00 — sessions must end by then
const SLOT_INTERVAL_MINUTES = 60; // slots land on the hour
export const BOOKING_BUFFER_MINUTES = 10;

/**
 * Bookable start times, on the hour from opening to the last slot.
 * The interval is fixed rather than derived from the duration so the
 * times stay round (16:00, 17:00) instead of drifting (16:10, 17:20).
 */
export function getBookingStartTimes(durationMinutes: number): string[] {
  const times: string[] = [];
  for (
    let startMin = OPENING_MINUTES;
    startMin <= LAST_SLOT_MINUTES;
    startMin += SLOT_INTERVAL_MINUTES
  ) {
    if (startMin + durationMinutes > CLOSING_MINUTES) break;
    const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
    const mm = String(startMin % 60).padStart(2, "0");
    times.push(`${hh}:${mm}`);
  }
  return times;
}

/**
 * The free start times for a date, given the calendar's busy intervals.
 * Takes the date as `YYYY-MM-DD` for the callers that never build a `Date` —
 * the MCP server and the WebMCP tools both receive the day as a string.
 */
export function getAvailableStartTimes(
  dateStr: string,
  durationMinutes: number,
  busyIntervals: { start: string; end: string }[],
): string[] {
  const bufferMs = BOOKING_BUFFER_MINUTES * 60 * 1000;

  return getBookingStartTimes(durationMinutes).filter((time) => {
    const slotStartMs = new Date(`${dateStr}T${time}:00`).getTime();
    const slotEndMs = slotStartMs + durationMinutes * 60 * 1000;

    return !busyIntervals.some(({ start, end }) => {
      const busyStartMs = new Date(start).getTime();
      const busyEndMs = new Date(end).getTime() + bufferMs;
      return slotStartMs < busyEndMs && slotEndMs > busyStartMs;
    });
  });
}

/**
 * The start times a set of staff schedules allows on a date.
 *
 * The union across the people who can perform the treatment: a slot is offered
 * when at least one of them works then and the session fits before they
 * finish. Returns an empty list for a day nobody works, which is what makes
 * the day unbookable.
 */
export function getScheduledStartTimes(
  date: Date,
  durationMinutes: number,
  schedules: StaffSchedule[],
): string[] {
  const weekday = String(date.getDay());
  const times = new Set<string>();

  for (const { schedule, slotIntervalMinutes } of schedules) {
    const day = schedule[weekday];
    if (!day?.open) continue;

    const start = toMinutes(day.start);
    const end = toMinutes(day.end);
    if (start == null || end == null) continue;

    const step = slotIntervalMinutes > 0 ? slotIntervalMinutes : 30;
    for (let m = start; m + durationMinutes <= end; m += step) {
      times.add(
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      );
    }
  }

  return [...times].sort();
}

function toMinutes(hhmm: string): number | null {
  const [h, m] = hhmm.split(":").map(Number);
  if (h == null || m == null || isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function computeSlots(
  date: Date,
  _category: string | undefined | null,
  durationMinutes: number,
  busyIntervals: { start: string; end: string }[],
): { time: string; booked: boolean }[] {
  const BUFFER_MS = BOOKING_BUFFER_MINUTES * 60 * 1000;
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const slots: { time: string; booked: boolean }[] = [];

  for (const time of getBookingStartTimes(durationMinutes)) {
    const slotStartMs = new Date(`${dateStr}T${time}:00`).getTime();
    const slotEndMs = slotStartMs + durationMinutes * 60 * 1000;

    const booked = busyIntervals.some(({ start, end }) => {
      const busyStartMs = new Date(start).getTime();
      const busyEndMs = new Date(end).getTime() + BUFFER_MS;
      return slotStartMs < busyEndMs && slotEndMs > busyStartMs;
    });

    slots.push({ time, booked });
  }

  return slots;
}
/**
 * Dashboard variant — takes explicit category and duration instead of BookableService.
 */
/**
 * Marks which of these start times the service's own calendar has taken.
 *
 * The times come from somewhere that already knows the professional's working
 * hours and their interval; this only adds what Google says about the room or
 * the service. Building the list here instead would impose one fixed grid on
 * everybody — which is exactly how a 15-minute interval became hourly.
 */
export function markBookedSlots(
  date: Date,
  times: string[],
  durationMinutes: number,
  busyIntervals: { start: string; end: string }[] = [],
): { time: string; booked: boolean }[] {
  const bufferMs = BOOKING_BUFFER_MINUTES * 60 * 1000;
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return times.map((time) => {
    const slotStartMs = new Date(`${dateStr}T${time}:00`).getTime();
    const slotEndMs = slotStartMs + durationMinutes * 60 * 1000;
    const booked = busyIntervals.some(({ start, end }) => {
      const busyStartMs = new Date(start).getTime();
      const busyEndMs = new Date(end).getTime() + bufferMs;
      return slotStartMs < busyEndMs && slotEndMs > busyStartMs;
    });
    return { time, booked };
  });
}

export function getTimeSlotsForDashboard(
  date: Date,
  category: string | undefined | null,
  durationMinutes: number,
  busyIntervals: { start: string; end: string }[] = [],
): { time: string; booked: boolean }[] {
  return computeSlots(date, category, durationMinutes, busyIntervals);
}
