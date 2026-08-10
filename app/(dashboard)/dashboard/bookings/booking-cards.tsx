"use client";

import { useTranslations } from "next-intl";
import {
  LocationBadge,
  StatusBadge,
} from "@/components/dashboard/booking-cells";
import {
  SOURCE_BADGE,
  formatBookingDate,
  locationDetail,
} from "@/utils/booking-display";
import type { Booking } from "./types";

/**
 * A page of bookings on a phone.
 *
 * Separate cards rather than table rows squeezed into a list: on a phone the
 * useful order is when, who, what, and each booking needs its own edge to be
 * scannable at a thumb's distance.
 */

function CardSkeleton() {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
        <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
      </div>
      <div className="bg-sand-100 mt-3 h-4 w-36 animate-pulse rounded" />
      <div className="bg-sand-100 mt-2 h-3 w-44 animate-pulse rounded" />
      <div className="mt-3 flex gap-2">
        <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
        <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  locale,
  onOpen,
}: {
  booking: Booking;
  locale: string;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("dashboard");
  const fullName =
    [booking.first_name, booking.last_name].filter(Boolean).join(" ") || "—";
  const room = locationDetail(
    booking.location,
    booking.location_address,
    (number) => `Room ${number}`,
  );
  const source =
    booking.created_by_role && SOURCE_BADGE[booking.created_by_role]
      ? booking.created_by_role
      : "anonymous";

  return (
    <button
      type="button"
      onClick={() => onOpen(booking.id)}
      style={{ borderLeftColor: booking.service_tiers?.color ?? "#c2baa5" }}
      className="border-sand-200 active:bg-sand-50 w-full rounded-2xl border border-l-4 bg-white p-4 text-left transition-colors"
    >
      {/* When it is — the first thing anyone looks for */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-petroleum-700 text-sm font-medium">
          {formatBookingDate(booking.date, locale)}
          {booking.time && (
            <span className="text-petroleum-400">
              {" · "}
              {booking.time.slice(0, 5)}
            </span>
          )}
        </p>
        <StatusBadge status={booking.status} />
      </div>

      <p className="text-petroleum-700 mt-3 truncate font-medium">{fullName}</p>
      {booking.email && (
        <p className="text-petroleum-400 truncate text-xs">{booking.email}</p>
      )}

      <p className="text-petroleum-500 mt-2 text-sm">
        {booking.service_tiers?.label ?? booking.service_title ?? "—"}
        {booking.duration && (
          <span className="text-petroleum-400 text-xs">
            {" · "}
            {booking.duration}
          </span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LocationBadge location={booking.location} />
        {room && <span className="text-petroleum-400 text-xs">{room}</span>}
        {/* Its own markup rather than the shared `SourceBadge`: pushed to the
        right and a shade tighter, because on a card it sits on the same line
        as the place and the room. */}
        <span
          className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[source]!.cls}`}
        >
          {t(`bookings.sources.${source}`)}
        </span>
      </div>
    </button>
  );
}

export function BookingCards({
  bookings,
  loading,
  locale,
  onOpen,
}: {
  bookings: Booking[];
  loading: boolean;
  locale: string;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="mb-4 flex flex-col gap-3 sm:hidden">
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
      ) : bookings.length === 0 ? (
        <p className="border-sand-200 text-petroleum-400 rounded-2xl border bg-white px-6 py-12 text-center text-sm">
          {t("bookings.empty")}
        </p>
      ) : (
        bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            locale={locale}
            onOpen={onOpen}
          />
        ))
      )}
    </div>
  );
}
