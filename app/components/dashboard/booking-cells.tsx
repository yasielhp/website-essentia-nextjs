"use client";

/**
 * The pieces a booking row is made of, shared by the bookings list and the
 * bookings table on a contact's page.
 *
 * They were local to the bookings screen, so the contact page showed the same
 * data in a different shape — a plain status word instead of a badge, no
 * location, no source. Keeping one definition means the two tables agree.
 */

import { useTranslations } from "next-intl";

// ─── Dates ────────────────────────────────────────────────────
//
// The formatters take the locale as an argument: they are plain functions, so
// they cannot reach the next-intl runtime themselves. Callers pass what
// `useDashboardLocale()` gives them.

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

// ─── Badges ───────────────────────────────────────────────────
//
// Each map holds styling only; the wording lives in `dashboard.bookings.*` so
// a value the database returns without a message still renders as itself.

const statusBadgeClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-600",
};

export function StatusBadge({ status }: { status: string | null }) {
  const t = useTranslations("dashboard.bookings");
  const s = status ?? "unknown";
  const cls = statusBadgeClasses[s] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {t.has(`status.${s}`) ? t(`status.${s}`) : s}
    </span>
  );
}

const locationBadgeClasses: Record<string, string> = {
  centro: "bg-blue-50 text-blue-700",
  habitacion: "bg-purple-50 text-purple-700",
  domicilio: "bg-teal-50 text-teal-700",
};

export function LocationBadge({ location }: { location: string | null }) {
  const t = useTranslations("dashboard.bookings");
  if (!location) return <span className="text-petroleum-300">—</span>;
  const label = t.has(`locations.${location}`)
    ? t(`locations.${location}`)
    : location;
  const cls =
    locationBadgeClasses[location] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

/** Who made the booking. `anonymous` is a booking taken through the website. */
export const SOURCE_BADGE: Record<string, { cls: string }> = {
  admin: { cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { cls: "bg-blue-100 text-blue-700" },
  partner: { cls: "bg-yellow-100 text-yellow-700" },
  client: { cls: "bg-green-50 text-green-700" },
  anonymous: { cls: "bg-sand-100 text-petroleum-500" },
};

export function SourceBadge({ role }: { role: string | null }) {
  const t = useTranslations("dashboard.bookings");
  const key = role && SOURCE_BADGE[role] ? role : "anonymous";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SOURCE_BADGE[key]!.cls}`}
    >
      {t(`sources.${key}`)}
    </span>
  );
}

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
