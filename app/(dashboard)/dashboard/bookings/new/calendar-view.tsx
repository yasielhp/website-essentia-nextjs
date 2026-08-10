"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { localDateStr } from "@/utils/format";
import {
  MONTH_NAMES,
  DAY_NAMES,
  isAvailableDay,
  isSameDay,
  getCalendarDays,
  getCalendarStartColumn,
} from "@/utils/calendar-helpers";

export function CalendarView({
  selected,
  onSelect,
  openDates,
  viewYear,
  viewMonth,
  onMonthChange,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  /** Days the chosen professional can actually take, `YYYY-MM-DD`. */
  openDates: Set<string>;
  /**
   * The month on show, owned by the page.
   *
   * It used to be local state here, announced upwards from an effect so the
   * page could ask for that month's availability — which meant every arrow
   * press rendered twice, once to move the calendar and once to tell the page
   * it had moved. The page needs the month to fetch with, so the page holds
   * it, and the arrows say what they did rather than an effect noticing.
   */
  viewYear: number;
  viewMonth: number;
  onMonthChange: (year: number, month: number) => void;
}) {
  const today = new Date();
  const days = getCalendarDays(viewYear, viewMonth);
  const startColumn = getCalendarStartColumn(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) onMonthChange(viewYear - 1, 11);
    else onMonthChange(viewYear, viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) onMonthChange(viewYear + 1, 0);
    else onMonthChange(viewYear, viewMonth + 1);
  };

  const tCal = useTranslations("dashboard.common");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          aria-label={tCal("prevMonth")}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-petroleum-700 text-sm font-semibold tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          aria-label={tCal("nextMonth")}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-petroleum-400 py-2 text-center text-xs font-semibold tracking-wide uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          // Open means both "not in the past" and "this person works then and
          // has the hour free" — the same answer the public site gets.
          const available =
            isAvailableDay(day) && openDates.has(localDateStr(day));
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={localDateStr(day)}
              // The 1st sits in its own weekday column; the rest follow it.
              style={i === 0 ? { gridColumnStart: startColumn } : undefined}
              type="button"
              disabled={!available}
              onClick={() => available && onSelect(day)}
              className={[
                "flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors",
                isSelected
                  ? "bg-petroleum-400 text-sand-50 shadow-sm"
                  : available
                    ? "text-petroleum-700 hover:bg-petroleum-100 border-petroleum-100 bg-petroleum-50 cursor-pointer border"
                    : "text-sand-400 border-sand-200 cursor-not-allowed border opacity-40",
              ].join(" ")}
            >
              {day.getDate()}
              {isToday && !isSelected && (
                <span className="bg-petroleum-400 mt-0.5 size-1 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
