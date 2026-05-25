import type { BookableService } from "@/data/services-data";

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

export function buildSteps(hasDatetime = true) {
  const steps = [
    { id: "service", label: "Service" },
    { id: "duration", label: "Session type" },
    { id: "details", label: "Your details" },
    ...(hasDatetime ? [{ id: "datetime", label: "Date & time" }] : []),
    { id: "confirm", label: "Confirm" },
  ];
  return steps;
}

export function getLocalizedMonthName(
  locale: string,
  year: number,
  month: number,
): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(year, month, 1),
  );
}

export function getLocalizedDayNames(locale: string): string[] {
  // Jan 6 2025 is a Monday — use Mon–Sun as base week
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(2025, 0, 6 + i),
    ),
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

export function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const OPENING_MINUTES = 8 * 60; // 08:00
const CLOSING_MINUTES = 19 * 60; // 19:00
const BUFFER_MINUTES = 10;

function computeSlots(
  date: Date,
  _category: string | undefined | null,
  durationMinutes: number,
  busyIntervals: { start: string; end: string }[],
): { time: string; booked: boolean }[] {
  const BUFFER_MS = BUFFER_MINUTES * 60 * 1000;
  const step = durationMinutes + BUFFER_MINUTES;
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const slots: { time: string; booked: boolean }[] = [];

  for (
    let startMin = OPENING_MINUTES;
    startMin + durationMinutes <= CLOSING_MINUTES;
    startMin += step
  ) {
    const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
    const mm = String(startMin % 60).padStart(2, "0");
    const time = `${hh}:${mm}`;

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

export function getTimeSlots(
  date: Date,
  service: BookableService,
  busyIntervals: { start: string; end: string }[] = [],
): { time: string; booked: boolean }[] {
  const durationMinutes =
    service.durations.length > 0
      ? parseInt(service.durations[0], 10) || 60
      : 60;
  return computeSlots(date, service.category, durationMinutes, busyIntervals);
}

/**
 * Dashboard variant — takes explicit category and duration instead of BookableService.
 */
export function getTimeSlotsForDashboard(
  date: Date,
  category: string | undefined | null,
  durationMinutes: number,
  busyIntervals: { start: string; end: string }[] = [],
): { time: string; booked: boolean }[] {
  return computeSlots(date, category, durationMinutes, busyIntervals);
}
