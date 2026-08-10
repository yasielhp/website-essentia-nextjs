"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  formatMediumDate,
  formatTimeOfDay,
  type SupportedLocale,
} from "@/utils/format";
import { activatable } from "@/lib/a11y";
import type { AccessType, Session } from "./types";

const ACCESS_COLORS: Record<AccessType, string> = {
  members_only: "bg-petroleum-50 text-petroleum-500",
  open: "bg-green-50 text-green-700",
  paid: "bg-yellow-50 text-yellow-700",
  paid_members_free: "bg-blue-50 text-blue-700",
};

/**
 * Every session, twice: cards on a phone and a table on a desk.
 *
 * The same shape the race list has, for the same reason — and, like it, both
 * versions and their skeletons used to sit inside the page that queries them.
 */
export function SessionList({
  sessions,
  loading,
  locale,
  onOpen,
}: {
  sessions: Session[];
  loading: boolean;
  locale: SupportedLocale;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("dashboard");

  return (
    <>
      {/* Mobile cards */}
      <div className="border-sand-200 divide-sand-200 mb-4 divide-y overflow-hidden rounded-2xl border bg-white sm:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-stretch">
              <div className="bg-sand-100 w-20 shrink-0 animate-pulse" />
              <div className="min-w-0 flex-1 px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="bg-sand-100 h-4 w-36 animate-pulse rounded" />
                  <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                </div>
                <div className="bg-sand-100 mt-2 h-3 w-40 animate-pulse rounded" />
                <div className="bg-sand-100 mt-1 h-3 w-28 animate-pulse rounded" />
              </div>
            </div>
          ))
        ) : sessions.length === 0 ? (
          <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
            {t("education.empty")}
          </p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              {...activatable(() => onOpen(session.id))}
              className="hover:bg-sand-50 flex cursor-pointer items-stretch transition-colors"
            >
              <div className="bg-sand-100 relative w-20 shrink-0 overflow-hidden">
                {session.image_url ? (
                  <Image
                    src={session.image_url}
                    alt={session.title}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="bg-sand-100 flex size-full items-center justify-center">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-petroleum-300"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="8.5"
                        cy="8.5"
                        r="1.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M21 15l-5-5L5 21"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-petroleum-700 truncate font-medium">
                    {session.title}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCESS_COLORS[session.access]}`}
                  >
                    {t(`education.access.${session.access}`)}
                  </span>
                </div>
                <p className="text-petroleum-400 mt-1 text-xs">
                  {formatMediumDate(session.date, locale)} ·{" "}
                  {formatTimeOfDay(session.date, locale)}
                  {session.duration_minutes != null
                    ? ` · ${t("education.minutes", { count: session.duration_minutes })}`
                    : ""}
                </p>
                <p className="text-petroleum-400 mt-0.5 text-xs">
                  {session.location ?? ""}
                  {session.location ? " · " : ""}
                  {session.max_participants != null
                    ? t("education.enrolledOfMax", {
                        count: session.registrations_count,
                        max: session.max_participants,
                      })
                    : t("education.enrolled", {
                        count: session.registrations_count,
                      })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Table (desktop only) */}
      <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 w-14 px-5 py-3.5 font-medium"></th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("education.columns.title")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("education.columns.access")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("education.columns.date")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("education.columns.time")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("education.columns.duration")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("education.columns.location")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("education.columns.enrolled")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {/* Image */}
                    <td className="px-5 py-3">
                      <div className="bg-sand-100 size-10 animate-pulse rounded-lg" />
                    </td>
                    {/* Title */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                    </td>
                    {/* Access badge */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
                    </td>
                    {/* Date */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                    </td>
                    {/* Time */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-16 animate-pulse rounded" />
                    </td>
                    {/* Duration */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-16 animate-pulse rounded" />
                    </td>
                    {/* Location */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                    </td>
                    {/* Enrolled/Max */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-20 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    {t("education.empty")}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => onOpen(session.id)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-5 py-3">
                      {session.image_url ? (
                        <div className="bg-sand-100 relative size-10 overflow-hidden rounded-lg">
                          <Image
                            src={session.image_url}
                            alt={session.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="bg-sand-100 flex size-10 items-center justify-center rounded-lg">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-petroleum-300"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <circle
                              cx="8.5"
                              cy="8.5"
                              r="1.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M21 15l-5-5L5 21"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {/* Same destination as the row click, reachable by keyboard. */}
                      <Link
                        href={`/dashboard/education/${session.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded outline-offset-2"
                      >
                        {session.title}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCESS_COLORS[session.access]}`}
                      >
                        {t(`education.access.${session.access}`)}
                      </span>
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatMediumDate(session.date, locale)}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatTimeOfDay(session.date, locale)}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {session.duration_minutes != null
                        ? t("education.minutes", {
                            count: session.duration_minutes,
                          })
                        : t("common.empty")}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {session.location ?? t("common.empty")}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {session.registrations_count}
                      {session.max_participants != null
                        ? ` / ${session.max_participants}`
                        : " / —"}
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
