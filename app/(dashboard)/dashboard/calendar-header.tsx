"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import type { CalendarView } from "@/types/calendar";
import type { CalNavAction } from "./cal-nav";

/**
 * Which view the calendar is in, and which period it is showing.
 *
 * Two arrangements of the same three controls — stacked on a phone, in a row on
 * a desk — which is why sixty lines say so little.
 */
export function CalendarHeader({
  view,
  periodLabel,
  dispatchCalNav,
}: {
  view: CalendarView;
  /** The month, week or day on show, already in words. */
  periodLabel: string;
  dispatchCalNav: Dispatch<CalNavAction>;
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="border-sand-200 flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-center">
      {/* View switcher — full width on mobile, auto on desktop */}
      <div className="border-sand-200 bg-sand-50 flex w-full rounded-xl border p-0.5 sm:w-auto">
        {(["month", "week", "day"] as CalendarView[]).map((v) => (
          <button
            key={v}
            onClick={() => dispatchCalNav({ type: "set-view", view: v })}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color,box-shadow] sm:flex-none ${
              view === v
                ? "text-petroleum-700 bg-white shadow-sm"
                : "text-petroleum-400 hover:text-petroleum-700"
            }`}
          >
            {t(`views.${v}`)}
          </button>
        ))}
      </div>

      {/* Period nav — mobile row */}
      <div className="flex w-full items-center justify-center gap-1 sm:hidden">
        <button
          onClick={() => dispatchCalNav({ type: "nav", delta: -1 })}
          aria-label={t("previousPeriod")}
          className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
        >
          ‹
        </button>
        <span className="text-petroleum-700 text-sm font-medium">
          {periodLabel}
        </span>
        <button
          onClick={() => dispatchCalNav({ type: "nav", delta: 1 })}
          aria-label={t("nextPeriod")}
          className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
        >
          ›
        </button>
      </div>

      {/* Period nav — desktop, pushed to the right */}
      <div className="ml-auto hidden items-center gap-1 sm:flex">
        <button
          onClick={() => dispatchCalNav({ type: "nav", delta: -1 })}
          aria-label={t("previousPeriod")}
          className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
        >
          ‹
        </button>
        <span className="text-petroleum-700 min-w-[148px] text-center text-sm font-medium">
          {periodLabel}
        </span>
        <button
          onClick={() => dispatchCalNav({ type: "nav", delta: 1 })}
          aria-label={t("nextPeriod")}
          className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
        >
          ›
        </button>
      </div>
    </div>
  );
}
