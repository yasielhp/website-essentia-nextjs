"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  LocationBadge,
  SourceBadge,
  StatusBadge,
} from "@/components/dashboard/booking-cells";
import {
  formatBookingDate,
  formatCreatedDate,
  formatCreatedTime,
  locationDetail,
} from "@/utils/booking-display";
import type { Booking } from "./types";

/** A page of bookings on a desk, one row each. */

const COLUMNS = [
  "created",
  "status",
  "client",
  "service",
  "location",
  "datetime",
  "reservedBy",
] as const;

function RowSkeleton() {
  return (
    <tr className="border-sand-50 border-b">
      {/* Created */}
      <td className="px-5 py-4">
        <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
        <div className="bg-sand-100 mt-1.5 h-3 w-14 animate-pulse rounded" />
      </td>
      {/* Status */}
      <td className="px-5 py-4">
        <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
      </td>
      {/* Client */}
      <td className="px-5 py-4">
        <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
        <div className="bg-sand-100 mt-1.5 h-3 w-36 animate-pulse rounded" />
      </td>
      {/* Service */}
      <td className="px-5 py-4">
        <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
        <div className="bg-sand-100 mt-1.5 h-3 w-16 animate-pulse rounded" />
      </td>
      {/* Location */}
      <td className="px-5 py-4">
        <div className="bg-sand-100 h-5 w-24 animate-pulse rounded-full" />
      </td>
      {/* Datetime */}
      <td className="px-5 py-4">
        <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
        <div className="bg-sand-100 mt-1.5 h-3 w-12 animate-pulse rounded" />
      </td>
      {/* Reserved by */}
      <td className="px-5 py-4">
        <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
      </td>
    </tr>
  );
}

function BookingRow({
  booking,
  locale,
  onOpen,
}: {
  booking: Booking;
  locale: string;
  onOpen: (id: string) => void;
}) {
  const room = locationDetail(
    booking.location,
    booking.location_address,
    (number) => `Room ${number}`,
  );

  return (
    <tr
      onClick={() => onOpen(booking.id)}
      className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
    >
      <td className="px-5 py-4">
        <p className="text-petroleum-500">
          {/* The row is clickable for a mouse; this is the same destination as
          something a keyboard can reach. */}
          <Link
            href={`/dashboard/bookings/${booking.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded outline-offset-2"
          >
            {formatCreatedDate(booking.created_at, locale)}
          </Link>
        </p>
        <p className="text-petroleum-400 text-xs">
          {formatCreatedTime(booking.created_at, locale)}
        </p>
      </td>
      <td className="px-5 py-4">
        <StatusBadge status={booking.status} />
      </td>
      <td className="px-5 py-4">
        <p className="text-petroleum-500">
          {[booking.first_name, booking.last_name].filter(Boolean).join(" ") ||
            "—"}
        </p>
        {booking.email && (
          <p className="text-petroleum-400 text-xs">{booking.email}</p>
        )}
      </td>
      <td className="px-5 py-4">
        <p className="text-petroleum-700 font-medium">
          {booking.service_title ?? "—"}
        </p>
        {(booking.service_tiers?.label || booking.duration) && (
          <p className="text-petroleum-400 text-xs">
            {[booking.service_tiers?.label, booking.duration]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </td>
      <td className="px-5 py-4">
        <LocationBadge location={booking.location} />
        {room && <p className="text-petroleum-400 mt-1 text-xs">{room}</p>}
      </td>
      <td className="px-5 py-4">
        <p className="text-petroleum-500">
          {formatBookingDate(booking.date, locale)}
        </p>
        {booking.time && (
          <p className="text-petroleum-400 text-xs">{booking.time}</p>
        )}
      </td>
      <td className="px-5 py-4">
        <SourceBadge role={booking.created_by_role} />
      </td>
    </tr>
  );
}

export function BookingTable({
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
    <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-sand-200 border-b text-left">
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className="text-petroleum-400 px-5 py-3.5 font-medium"
                >
                  {t(`bookings.columns.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
            ) : bookings.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="text-petroleum-400 px-6 py-12 text-center"
                >
                  {t("bookings.empty")}
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  locale={locale}
                  onOpen={onOpen}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
