import type { WeeklySchedule } from "@/types/schedule";

/** Monday first, which is how the week reads here — Sunday is JS day 0. */
const WEEK = ["1", "2", "3", "4", "5", "6", "0"];

const HOURS = { start: "08:00", end: "19:00" };

/**
 * Fills in any weekday the stored value is missing.
 *
 * Weekends default closed, matching the column's own default. An all-open
 * fallback silently turned a profile whose schedule failed to load into
 * someone working seven days a week.
 */
export function normaliseSchedule(
  schedule: WeeklySchedule | null,
): WeeklySchedule {
  const full: WeeklySchedule = {};
  for (const day of WEEK) {
    full[day] = schedule?.[day] ?? {
      open: day !== "0" && day !== "6",
      ...HOURS,
    };
  }
  return full;
}
