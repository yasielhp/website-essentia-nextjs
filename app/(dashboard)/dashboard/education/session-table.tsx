"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  formatMediumDate,
  formatTimeOfDay,
  type SupportedLocale,
} from "@/utils/format";
import { AccessBadge, SessionThumbnail } from "./session-cells";
import type { Session } from "./types";

/** Every session on a desk, one row each. */

const COLUMNS = [
  "title",
  "access",
  "date",
  "time",
  "duration",
  "location",
  "enrolled",
] as const;
/** The seven named columns, plus the picture's, which has no heading. */
const COL_COUNT = COLUMNS.length + 1;

/**
 * The shape each cell takes while it waits, matching what lands in it — the
 * access column is a badge, the rest are lines of text of their own width.
 */
const SKELETON_CELLS = [
  "h-4 w-40 rounded",
  "h-5 w-20 rounded-full",
  "h-4 w-24 rounded",
  "h-4 w-16 rounded",
  "h-4 w-16 rounded",
  "h-4 w-32 rounded",
  "h-4 w-20 rounded",
];

function RowSkeleton() {
  return (
    <tr className="border-sand-50 border-b">
      <td className="px-5 py-3">
        <div className="bg-sand-100 size-10 animate-pulse rounded-lg" />
      </td>
      {SKELETON_CELLS.map((shape, i) => (
        <td key={i} className="px-5 py-4">
          <div className={`bg-sand-100 animate-pulse ${shape}`} />
        </td>
      ))}
    </tr>
  );
}

function SessionRow({
  session,
  locale,
  onOpen,
}: {
  session: Session;
  locale: SupportedLocale;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("dashboard");

  return (
    <tr
      onClick={() => onOpen(session.id)}
      className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
    >
      <td className="px-5 py-3">
        <SessionThumbnail session={session} variant="square" />
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
        <AccessBadge access={session.access} />
      </td>
      <td className="text-petroleum-500 px-5 py-4">
        {formatMediumDate(session.date, locale)}
      </td>
      <td className="text-petroleum-500 px-5 py-4">
        {formatTimeOfDay(session.date, locale)}
      </td>
      <td className="text-petroleum-400 px-5 py-4">
        {session.duration_minutes != null
          ? t("education.minutes", { count: session.duration_minutes })
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
  );
}

export function SessionTable({
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
    <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-sand-200 border-b text-left">
              <th className="text-petroleum-400 w-14 px-5 py-3.5 font-medium"></th>
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className="text-petroleum-400 px-5 py-3.5 font-medium"
                >
                  {t(`education.columns.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
            ) : sessions.length === 0 ? (
              <tr>
                <td
                  colSpan={COL_COUNT}
                  className="text-petroleum-400 px-6 py-12 text-center"
                >
                  {t("education.empty")}
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
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
