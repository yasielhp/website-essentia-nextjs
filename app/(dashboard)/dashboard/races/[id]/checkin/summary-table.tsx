"use client";

import { useTranslations } from "next-intl";
import type { Registration } from "./types";

/**
 * Everyone on the list, with their table and whether they have arrived.
 *
 * Shown only when nobody is searching and nobody is selected — it is the view
 * of the room before the door opens, and it was a hundred lines at the bottom
 * of the page that runs the door.
 */
export function SummaryTable({
  registrations,
  onSelect,
}: {
  registrations: Registration[];
  /** Picking a row is the same as searching for that person and choosing them. */
  onSelect: (registration: Registration) => void;
}) {
  const t = useTranslations("dashboard.races.checkin");

  return (
    <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
      <div className="border-sand-100 border-b px-5 py-3">
        <p className="text-petroleum-500 text-sm font-medium">
          {t("allRegistrations")}
        </p>
      </div>
      <div className="divide-sand-100 divide-y">
        {registrations.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className="hover:bg-sand-50 flex w-full items-center justify-between px-5 py-3 text-left transition-colors"
          >
            <div>
              <p className="text-petroleum-700 text-sm font-medium">
                {r.full_name ?? "—"}
              </p>
              {r.email && (
                <p className="text-petroleum-400 text-xs">{r.email}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {r.table_number != null && (
                <span className="bg-petroleum-100 text-petroleum-500 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {t("table", { number: r.table_number })}
                </span>
              )}
              {r.checked_in_at ? (
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  ✓
                </span>
              ) : (
                <span className="bg-sand-100 text-petroleum-400 rounded-full px-2.5 py-0.5 text-xs">
                  {t("pending")}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
