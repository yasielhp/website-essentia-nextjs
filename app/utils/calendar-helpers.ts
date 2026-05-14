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

export function buildSteps() {
  return [
    { id: "service", label: "Service" },
    { id: "duration", label: "Duration" },
    { id: "details", label: "Your details" },
    { id: "datetime", label: "Date & time" },
    { id: "confirm", label: "Confirm" },
  ];
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
  const dow = d.getDay();
  return dow !== 0 && dow !== 6;
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

export function getTimeSlots(
  date: Date,
  service: BookableService,
): { time: string; booked: boolean }[] {
  const base =
    service.category === "medicine"
      ? ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"]
      : [
          "09:00",
          "10:00",
          "11:00",
          "12:00",
          "15:00",
          "16:00",
          "17:00",
          "18:00",
        ];
  const seed = date.getDate() + date.getMonth();
  return base.map((time, i) => ({ time, booked: (seed + i) % 5 === 0 }));
}
