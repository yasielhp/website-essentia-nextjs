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
import { SOURCE_BADGE } from "@/utils/booking-display";

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
