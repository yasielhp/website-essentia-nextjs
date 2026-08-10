"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { displayEmail, displayPhone } from "@/utils/contact";
import { activatable } from "@/lib/a11y";
import type { DisplayRow } from "./types";

const ROLE_BADGE: Record<string, { cls: string }> = {
  admin: { cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { cls: "bg-blue-100 text-blue-700" },
  partner: { cls: "bg-yellow-100 text-yellow-700" },
  lead: { cls: "bg-sand-100 text-petroleum-500" },
  client: { cls: "bg-green-50 text-green-700" },
  member: { cls: "bg-petroleum-50 text-petroleum-600" },
};

const ROLE_BADGE_FALLBACK = { cls: "bg-sand-100 text-petroleum-500" };

function AvatarFallback() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="text-petroleum-300"
    >
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Everyone this screen lists: cards on a phone, a table on a desk.
 *
 * Both renderings, both skeletons and the badge colours came to nearly two
 * hundred lines in the middle of the page that fetches contacts, system users
 * and their counts. The page keeps the fetching; this keeps the showing.
 */
export function UserTable({
  rows,
  loading,
  locale,
  onOpen,
}: {
  rows: DisplayRow[];
  loading: boolean;
  locale: SupportedLocale;
  onOpen: (row: DisplayRow) => void;
}) {
  const t = useTranslations("dashboard");
  // Roles and genders come from the database, so unmapped values are possible.
  const roleLabel = (role: string) =>
    t.has(`users.roles.${role}`) ? t(`users.roles.${role}`) : role;
  const genderText = (gender: string | null | undefined) =>
    gender && t.has(`users.gender.${gender}`)
      ? t(`users.gender.${gender}`)
      : t("common.empty");

  return (
    <>
      {/* Mobile cards */}
      <div className="sm:hidden">
        {loading ? (
          <div className="divide-sand-200 border-sand-200 divide-y overflow-hidden rounded-2xl border bg-white">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <div className="bg-sand-100 size-9 shrink-0 animate-pulse rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
                    <div className="bg-sand-100 h-5 w-14 animate-pulse rounded-full" />
                  </div>
                  <div className="bg-sand-100 mt-1.5 h-3 w-44 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-petroleum-400 py-12 text-center text-sm">
            {t("users.empty")}
          </p>
        ) : (
          <div className="divide-sand-200 border-sand-200 divide-y overflow-hidden rounded-2xl border bg-white">
            {rows.map((row) => {
              const badge = ROLE_BADGE[row.role] ?? ROLE_BADGE_FALLBACK;
              return (
                <div
                  key={row.id}
                  {...activatable(() => onOpen(row))}
                  className="hover:bg-sand-50 flex cursor-pointer items-center gap-3 px-4 py-4 transition-colors"
                >
                  <div className="bg-sand-100 flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <AvatarFallback />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-petroleum-700 truncate font-medium">
                        {row.name}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {roleLabel(row.role)}
                      </span>
                    </div>
                    {row.email && (
                      <p className="text-petroleum-400 mt-0.5 truncate text-sm">
                        {displayEmail(row.email)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-sand-200 border-b text-left">
                  <th className="text-petroleum-400 w-10 px-5 py-3.5 font-medium" />
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    {t("users.columns.name")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    {t("users.columns.phone")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    {t("users.columns.gender")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    {t("users.columns.role")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    {t("users.columns.created")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {/* Avatar */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 size-9 animate-pulse rounded-lg" />
                      </td>
                      {/* Name */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                      </td>
                      {/* Phone */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
                      </td>
                      {/* Gender */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-4 w-20 animate-pulse rounded" />
                      </td>
                      {/* Role badge */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                      </td>
                      {/* Created */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-petroleum-400 px-6 py-12 text-center"
                    >
                      {t("users.empty")}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const badge = ROLE_BADGE[row.role] ?? ROLE_BADGE_FALLBACK;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => onOpen(row)}
                        className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="bg-sand-100 flex size-9 items-center justify-center rounded-lg">
                            <AvatarFallback />
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-petroleum-700 font-medium">
                            {/* Same destination as the row click, reachable by keyboard. */}
                            <Link
                              href={row.href}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded outline-offset-2"
                            >
                              {row.name}
                            </Link>
                          </p>
                          <p className="text-petroleum-400 mt-0.5 text-xs">
                            {displayEmail(row.email)}
                          </p>
                        </td>
                        <td className="text-petroleum-400 px-5 py-3">
                          {displayPhone(row.phone)}
                        </td>
                        <td className="text-petroleum-400 px-5 py-3">
                          {genderText(row.gender)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
                          >
                            {roleLabel(row.role)}
                          </span>
                        </td>
                        <td className="text-petroleum-400 px-5 py-3">
                          {formatMediumDate(row.created_at, locale)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
