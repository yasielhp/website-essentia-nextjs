import { parseDurationMinutes } from "@/utils/format";

const TIME_ZONE = "Atlantic/Canary";

/** Offset (ms) of the Canaries from UTC at the given instant. */
function zoneOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The UTC instant at which the wall clock in the Canaries reads `day` +
 * `time`. Never goes through the server's own timezone, so it gives the same
 * answer on a laptop in Madrid and on a UTC host.
 */
export function canaryWallClockToUtc(day: string, time: string): Date {
  const [y = 0, m = 1, d = 1] = day.slice(0, 10).split("-").map(Number);
  const [hh = 0, mm = 0] = time.slice(0, 5).split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle on the right offset when the guess straddles a DST change.
  const first = naive - zoneOffsetMs(naive);
  return new Date(naive - zoneOffsetMs(first));
}

/**
 * ISO instant at which a booking ends: its start in Canary wall-clock time
 * plus its duration. Null when the booking has no date or time.
 */
export function visitEndsAtIso(
  date: string | null,
  time: string | null,
  duration: string | null,
): string | null {
  if (!date || !time) return null;
  const start = canaryWallClockToUtc(date, time);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(
    start.getTime() + parseDurationMinutes(duration) * 60_000,
  ).toISOString();
}
