import { localDay } from "@/lib/campaigns/automation-rules";

/** Today as the centre reads it (`YYYY-MM-DD`, Atlantic/Canary). */
export function bonusToday(now: Date = new Date()): string {
  return localDay(now);
}

/**
 * The last day a bonus can be used: the day it was bought plus its validity.
 * Both ends are plain dates and the sum is done in UTC, so a change of clock
 * never moves the day.
 */
export function bonusExpiry(today: string, validityDays: number): string {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + validityDays))
    .toISOString()
    .slice(0, 10);
}
