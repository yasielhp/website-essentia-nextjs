/**
 * Values a booking row is made of, minus the markup.
 *
 * They lived beside the components that render them, which meant a component
 * file exporting plain functions — and a component file that exports
 * non-components cannot keep its state across a Fast Refresh.
 *
 * The formatters take the locale as an argument: they are plain functions, so
 * they cannot reach the next-intl runtime themselves. Callers pass what
 * `useDashboardLocale()` gives them.
 *
 * Not to be confused with `formatBookingDate` in `utils/format.ts`, which is
 * the long, client-facing form used in emails. This one is the short form the
 * dashboard tables use.
 */

/** `20 may 2026` from a `YYYY-MM-DD` value, built without a UTC shift. */
export function formatBookingDate(
  dateStr: string | null,
  locale: string,
): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3) return dateStr;
  const [y, m, d] = parts as [number, number, number];
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

/** Date half of a creation timestamp. */
export function formatCreatedDate(
  isoStr: string | null,
  locale: string,
): string {
  if (!isoStr) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(isoStr));
}

/** Time half of a creation timestamp. */
export function formatCreatedTime(
  isoStr: string | null,
  locale: string,
): string {
  if (!isoStr) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoStr));
}

/** Who made the booking. `anonymous` is a booking taken through the website. */
export const SOURCE_BADGE: Record<string, { cls: string }> = {
  admin: { cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { cls: "bg-blue-100 text-blue-700" },
  partner: { cls: "bg-yellow-100 text-yellow-700" },
  client: { cls: "bg-green-50 text-green-700" },
  anonymous: { cls: "bg-sand-100 text-petroleum-500" },
};

/**
 * The reservation and room numbers a partner records for a hotel booking, kept
 * in `location_address` as JSON. Malformed values are skipped rather than
 * breaking the row.
 *
 * `roomLabel` renders the room number — the caller supplies it from the
 * `dashboard.bookings.room` message.
 */
export function locationDetail(
  location: string | null,
  locationAddress: string | null,
  roomLabel: (number: string) => string,
): string | null {
  if (location !== "centro" && location !== "habitacion") return null;
  if (!locationAddress) return null;

  try {
    const addr = JSON.parse(locationAddress) as Record<string, string>;
    const parts = [
      addr.reservationNumber ? `#${addr.reservationNumber}` : null,
      addr.roomNumber ? roomLabel(addr.roomNumber) : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  } catch {
    return null;
  }
}
