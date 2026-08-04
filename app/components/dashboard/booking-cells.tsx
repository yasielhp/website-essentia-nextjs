"use client";

/**
 * The pieces a booking row is made of, shared by the bookings list and the
 * bookings table on a contact's page.
 *
 * They were local to the bookings screen, so the contact page showed the same
 * data in a different shape — a plain status word instead of a badge, no
 * location, no source. Keeping one definition means the two tables agree.
 */

// ─── Dates ────────────────────────────────────────────────────
//
// `es-ES` here, deliberately: these are dashboard-only surfaces, and the
// existing bookings screen already reads dates this way.

/** `20 may 2026` from a `YYYY-MM-DD` value, built without a UTC shift. */
export function formatBookingDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3) return dateStr;
  const [y, m, d] = parts as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Date half of a creation timestamp. */
export function formatCreatedDate(isoStr: string | null): string {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Time half of a creation timestamp. */
export function formatCreatedTime(isoStr: string | null): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Badges ───────────────────────────────────────────────────

const statusBadgeClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-600",
};

export function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const cls = statusBadgeClasses[s] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {s}
    </span>
  );
}

const locationLabels: Record<string, string> = {
  centro: "At the center",
  habitacion: "Room",
  domicilio: "Home visit",
};

const locationBadgeClasses: Record<string, string> = {
  centro: "bg-blue-50 text-blue-700",
  habitacion: "bg-purple-50 text-purple-700",
  domicilio: "bg-teal-50 text-teal-700",
};

export function LocationBadge({ location }: { location: string | null }) {
  if (!location) return <span className="text-petroleum-300">—</span>;
  const label = locationLabels[location] ?? location;
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
export const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { label: "Staff", cls: "bg-blue-100 text-blue-700" },
  partner: { label: "Partner", cls: "bg-yellow-100 text-yellow-700" },
  client: { label: "Client", cls: "bg-green-50 text-green-700" },
  anonymous: { label: "Web", cls: "bg-sand-100 text-petroleum-500" },
};

export function SourceBadge({ role }: { role: string | null }) {
  const src = SOURCE_BADGE[role ?? ""] ?? SOURCE_BADGE["anonymous"]!;
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${src.cls}`}
    >
      {src.label}
    </span>
  );
}

/**
 * The reservation and room numbers a partner records for a hotel booking, kept
 * in `location_address` as JSON. Malformed values are skipped rather than
 * breaking the row.
 */
export function locationDetail(
  location: string | null,
  locationAddress: string | null,
): string | null {
  if (location !== "centro" && location !== "habitacion") return null;
  if (!locationAddress) return null;

  try {
    const addr = JSON.parse(locationAddress) as Record<string, string>;
    const parts = [
      addr.reservationNumber ? `#${addr.reservationNumber}` : null,
      addr.roomNumber ? `Room ${addr.roomNumber}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  } catch {
    return null;
  }
}
