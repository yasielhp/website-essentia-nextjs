"use client";

import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";

/**
 * The one bar of the table of people: the search on the left, and on the right
 * either how many are shown (nothing picked) or how many of everybody are
 * picked. Picking and clearing are the checkboxes' job, the header one for the
 * whole list. Plain values in, so a test can pin each state.
 */
export function PeopleBar({
  search,
  onSearch,
  ready,
  shown,
  total,
  selected,
  full,
}: {
  search: string;
  onSearch: (value: string) => void;
  /** The people are loaded; until then no count is told, never a made-up zero. */
  ready: boolean;
  /** How many the table lists after the filters and the search. */
  shown: number;
  /** How many people there are, before them. */
  total: number;
  /** How many are picked (those that still exist). */
  selected: number;
  /** The list holds as many as it can. */
  full: boolean;
}) {
  const t = useTranslations("dashboard.campaigns.segments.form");
  return (
    <div className="border-sand-100 flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className={`${INPUT_CLASS} sm:max-w-sm`}
      />
      {ready &&
        (selected === 0 ? (
          <p className="text-petroleum-400 text-xs">
            {shown === total
              ? t("count", { count: total })
              : t("countOf", { shown, total })}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0 text-sm">
            <span className="text-petroleum-700 font-semibold">
              {t("selectedCount", { count: selected, total })}
            </span>
            {full && (
              <span role="status" className="font-medium text-yellow-800">
                {t("listFull")}
              </span>
            )}
          </div>
        ))}
    </div>
  );
}
