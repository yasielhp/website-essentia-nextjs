"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { activatable } from "@/lib/a11y";
import type { Race, RaceAccess } from "./types";

const RACE_ACCESS_COLORS: Record<RaceAccess, string> = {
  members: "bg-petroleum-50 text-petroleum-500",
  open: "bg-green-50 text-green-700",
};

/**
 * Every race, twice: as cards on a phone and as a table on a desk.
 *
 * Both shapes, and both loading skeletons, lived in the page that queries
 * them — which is why the page was five hundred lines to show one list.
 */
export function RaceList({
  races,
  loading,
  locale,
  onOpen,
}: {
  races: Race[];
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
        ) : races.length === 0 ? (
          <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
            {t("races.empty")}
          </p>
        ) : (
          races.map((race) => (
            <div
              key={race.id}
              {...activatable(() => onOpen(race.id))}
              className="hover:bg-sand-50 flex cursor-pointer items-stretch transition-colors"
            >
              <div className="bg-sand-100 relative w-20 shrink-0 overflow-hidden">
                {race.image_url ? (
                  <Image
                    src={race.image_url}
                    alt={race.title}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="bg-petroleum-700/10 flex size-full items-center justify-center">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-petroleum-400"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
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
                    {race.title}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RACE_ACCESS_COLORS[race.access]}`}
                  >
                    {t(`races.access.${race.access}`)}
                  </span>
                </div>
                <p className="text-petroleum-400 mt-1 text-xs">
                  {formatMediumDate(race.date, locale)}
                  {race.location ? ` · ${race.location}` : ""}
                </p>
                <p className="text-petroleum-400 mt-0.5 text-xs">
                  {race.distance_km != null ? `${race.distance_km} km · ` : ""}
                  {race.max_participants != null
                    ? t("races.registeredOfMax", {
                        count: race.registrations_count,
                        max: race.max_participants,
                      })
                    : t("races.registered", {
                        count: race.registrations_count,
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
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="w-14 px-4 py-3.5"></th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("races.columns.title")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("races.columns.access")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("races.columns.date")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("races.columns.location")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("races.columns.distance")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("races.columns.registered")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {/* Image thumbnail */}
                    <td className="px-4 py-3">
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
                    {/* Location */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                    </td>
                    {/* Distance */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-16 animate-pulse rounded" />
                    </td>
                    {/* Registered/Max */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-20 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : races.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    {t("races.empty")}
                  </td>
                </tr>
              ) : (
                races.map((race) => (
                  <tr
                    key={race.id}
                    onClick={() => onOpen(race.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onOpen(race.id);
                    }}
                    tabIndex={0}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="bg-sand-100 relative size-10 shrink-0 overflow-hidden rounded-lg">
                        {race.image_url ? (
                          <Image
                            src={race.image_url}
                            alt={race.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <div className="bg-petroleum-700/10 flex size-full items-center justify-center">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="text-petroleum-400"
                            >
                              <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="3"
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
                    </td>
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {race.title}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RACE_ACCESS_COLORS[race.access]}`}
                      >
                        {t(`races.access.${race.access}`)}
                      </span>
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatMediumDate(race.date, locale)}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {race.location ?? t("common.empty")}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {race.distance_km != null ? (
                        `${race.distance_km} km`
                      ) : (
                        <span className="text-petroleum-400">{"—"}</span>
                      )}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      <span
                        className={
                          race.max_participants != null &&
                          race.registrations_count >= race.max_participants
                            ? "font-medium text-red-500"
                            : ""
                        }
                      >
                        {race.registrations_count}
                      </span>
                      {race.max_participants != null ? (
                        <span className="text-petroleum-400">
                          {" "}
                          / {race.max_participants}
                        </span>
                      ) : (
                        <span className="text-petroleum-400">{" / —"}</span>
                      )}
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
