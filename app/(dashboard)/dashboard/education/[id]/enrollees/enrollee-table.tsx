"use client";

import { useLocale, useTranslations } from "next-intl";
import { TIME_ZONE } from "@/utils/format";
import { EnrolleeRow } from "./enrollee-sections";
import type { Enrollee, Session } from "./types";

const COLUMNS = ["name", "email", "phone", "enrolledAt"] as const;
/** The four named columns, plus the row number and the remove button. */
const COL_COUNT = COLUMNS.length + 2;

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

/**
 * Everyone on this session, with the day and the count above them.
 *
 * The count turns red once it reaches the cap — the one thing on this screen
 * somebody needs to see without reading.
 */
export function EnrolleeTable({
  session,
  enrollees,
  loading,
  removeOpen,
  removingId,
  onConfirmOpen,
  onConfirmClose,
  onRemove,
}: {
  session: Session | null;
  enrollees: Enrollee[];
  loading: boolean;
  /** The enrollee whose confirmation is open, if any. */
  removeOpen: string | null;
  removingId: string | null;
  onConfirmOpen: (id: string) => void;
  onConfirmClose: () => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("dashboard.education.enrollees");
  const locale = useLocale();

  return (
    <div className="border-sand-200 rounded-2xl border bg-white">
      {!loading && session && (
        <div className="border-sand-100 flex items-center justify-between border-b px-5 py-3">
          <p className="text-petroleum-400 text-sm">
            {formatDate(session.date, locale)}
          </p>
          <p className="text-petroleum-400 text-sm">
            {t("count", { count: enrollees.length })}
            {session.max_participants != null && (
              <span
                className={
                  enrollees.length >= session.max_participants
                    ? "font-medium text-red-500"
                    : ""
                }
              >
                {t("ofMax", { max: session.max_participants })}
              </span>
            )}
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-140 text-sm">
          <thead>
            <tr className="border-sand-200 border-b text-left">
              <th className="text-petroleum-400 px-5 py-3.5 font-medium">#</th>
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className="text-petroleum-400 px-5 py-3.5 font-medium"
                >
                  {t(`columns.${column}`)}
                </th>
              ))}
              {/* The remove button's column has no name. */}
              <th className="text-petroleum-400 px-5 py-3.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-sand-50 border-b">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="bg-sand-100 h-4 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : enrollees.length === 0 ? (
              <tr>
                <td
                  colSpan={COL_COUNT}
                  className="text-petroleum-400 px-6 py-12 text-center"
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              enrollees.map((enrollee, index) => (
                <EnrolleeRow
                  key={enrollee.id}
                  enrollee={enrollee}
                  index={index}
                  removeOpen={removeOpen}
                  removingId={removingId}
                  onConfirmOpen={onConfirmOpen}
                  onConfirmClose={onConfirmClose}
                  onRemove={onRemove}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
