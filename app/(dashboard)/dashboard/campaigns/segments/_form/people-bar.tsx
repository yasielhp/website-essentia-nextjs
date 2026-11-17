"use client";

import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";

const LINK =
  "text-petroleum-700 inline-flex min-h-11 items-center font-medium underline underline-offset-2 sm:min-h-8";

/**
 * The one bar of the table of people: the search on the left, and on the right
 * either how many are shown (nothing picked) or what is picked and what can be
 * done with it, each thing once. Plain values in, so a test can pin each state.
 */
export function PeopleBar({
  search,
  onSearch,
  ready,
  shown,
  total,
  selected,
  canSelectAll,
  full,
  onlySelected,
  onToggleOnly,
  onSelectAll,
  onClear,
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
  /** More people are listed than are picked, and the list has room. */
  canSelectAll: boolean;
  /** The list holds as many as it can. */
  full: boolean;
  onlySelected: boolean;
  onToggleOnly: () => void;
  onSelectAll: () => void;
  onClear: () => void;
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
              {t("selectedCount", { count: selected })}
            </span>
            {full && (
              <span role="status" className="font-medium text-yellow-800">
                {t("listFull")}
              </span>
            )}
            {canSelectAll && (
              <button type="button" onClick={onSelectAll} className={LINK}>
                {t("selectAllN", { total: shown })}
              </button>
            )}
            <button
              type="button"
              aria-pressed={onlySelected}
              onClick={onToggleOnly}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 text-xs transition-colors sm:min-h-8 ${
                onlySelected
                  ? "border-petroleum-700 bg-petroleum-700 text-white"
                  : "border-sand-200 text-petroleum-700 hover:border-petroleum-400 bg-white"
              }`}
            >
              {t("onlySelected")}
            </button>
            <button type="button" onClick={onClear} className={LINK}>
              {t("clearSelection")}
            </button>
          </div>
        ))}
    </div>
  );
}
