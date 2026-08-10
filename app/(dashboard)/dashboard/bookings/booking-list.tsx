"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  LocationBadge,
  StatusBadge,
} from "@/components/dashboard/booking-cells";
import {
  SOURCE_BADGE,
  formatBookingDate,
  formatCreatedDate,
  formatCreatedTime,
} from "@/utils/booking-display";
import type { Booking } from "./types";

const COL_COUNT = 7;

/** Falls back to the website-booking badge for a role we have no styling for. */
function sourceKey(role: string | null): string {
  return role && SOURCE_BADGE[role] ? role : "anonymous";
}

/**
 * A page of bookings, twice over: cards on a phone, a table on a desk.
 *
 * Nearly three hundred lines of it, inside a page that also holds the filters,
 * the date presets, the stats and the query. Whoever came to change a column
 * had to scroll past all of that first.
 */
export function BookingList({
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
    <>
      {/* Mobile cards — separate cards rather than table rows squeezed into
      a list: on a phone the useful order is when, who, what, and each
      booking needs its own edge to be scannable at a thumb's distance. */}
      <div className="mb-4 flex flex-col gap-3 sm:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-sand-200 rounded-2xl border bg-white p-4"
            >
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
          ))
        ) : bookings.length === 0 ? (
          <p className="border-sand-200 text-petroleum-400 rounded-2xl border bg-white px-6 py-12 text-center text-sm">
            {t("bookings.empty")}
          </p>
        ) : (
          bookings.map((b) => {
            const fullName =
              [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
            const room = (() => {
              if (!b.location_address) return null;
              try {
                const addr = JSON.parse(b.location_address) as Record<
                  string,
                  string
                >;
                return (
                  [
                    addr.reservationNumber
                      ? `#${addr.reservationNumber}`
                      : null,
                    addr.roomNumber ? `Room ${addr.roomNumber}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                );
              } catch {
                return null;
              }
            })();

            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onOpen(b.id)}
                style={{
                  borderLeftColor: b.service_tiers?.color ?? "#c2baa5",
                }}
                className="border-sand-200 active:bg-sand-50 w-full rounded-2xl border border-l-4 bg-white p-4 text-left transition-colors"
              >
                {/* When it is — the first thing anyone looks for */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-petroleum-700 text-sm font-medium">
                    {formatBookingDate(b.date, locale)}
                    {b.time && (
                      <span className="text-petroleum-400">
                        {" · "}
                        {b.time.slice(0, 5)}
                      </span>
                    )}
                  </p>
                  <StatusBadge status={b.status} />
                </div>

                <p className="text-petroleum-700 mt-3 truncate font-medium">
                  {fullName}
                </p>
                {b.email && (
                  <p className="text-petroleum-400 truncate text-xs">
                    {b.email}
                  </p>
                )}

                <p className="text-petroleum-500 mt-2 text-sm">
                  {b.service_tiers?.label ?? b.service_title ?? "—"}
                  {b.duration && (
                    <span className="text-petroleum-400 text-xs">
                      {" · "}
                      {b.duration}
                    </span>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <LocationBadge location={b.location} />
                  {room && (
                    <span className="text-petroleum-400 text-xs">{room}</span>
                  )}
                  {(() => {
                    const source = sourceKey(b.created_by_role);
                    return (
                      <span
                        className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[source]!.cls}`}
                      >
                        {t(`bookings.sources.${source}`)}
                      </span>
                    );
                  })()}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Table (desktop only) */}
      <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.created")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.status")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.client")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.service")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.location")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.datetime")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.reservedBy")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
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
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={COL_COUNT}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    {t("bookings.empty")}
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => onOpen(b.id)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-petroleum-500">
                        {/* The row is clickable for a mouse; this is the same
                        destination as something a keyboard can reach. */}
                        <Link
                          href={`/dashboard/bookings/${b.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded outline-offset-2"
                        >
                          {formatCreatedDate(b.created_at, locale)}
                        </Link>
                      </p>
                      <p className="text-petroleum-400 text-xs">
                        {formatCreatedTime(b.created_at, locale)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-petroleum-500">
                        {[b.first_name, b.last_name]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                      {b.email && (
                        <p className="text-petroleum-400 text-xs">{b.email}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-petroleum-700 font-medium">
                        {b.service_title ?? "—"}
                      </p>
                      {(b.service_tiers?.label || b.duration) && (
                        <p className="text-petroleum-400 text-xs">
                          {[b.service_tiers?.label, b.duration]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <LocationBadge location={b.location} />
                      {(b.location === "centro" ||
                        b.location === "habitacion") &&
                        b.location_address &&
                        (() => {
                          try {
                            const addr = JSON.parse(
                              b.location_address,
                            ) as Record<string, string>;
                            const parts = [
                              addr.reservationNumber
                                ? `#${addr.reservationNumber}`
                                : null,
                              addr.roomNumber
                                ? `Room ${addr.roomNumber}`
                                : null,
                            ].filter(Boolean);
                            return parts.length > 0 ? (
                              <p className="text-petroleum-400 mt-1 text-xs">
                                {parts.join(" · ")}
                              </p>
                            ) : null;
                          } catch {
                            return null;
                          }
                        })()}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-petroleum-500">
                        {formatBookingDate(b.date, locale)}
                      </p>
                      {b.time && (
                        <p className="text-petroleum-400 text-xs">{b.time}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {(() => {
                        const source = sourceKey(b.created_by_role);
                        return (
                          <span
                            className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SOURCE_BADGE[source]!.cls}`}
                          >
                            {t(`bookings.sources.${source}`)}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
