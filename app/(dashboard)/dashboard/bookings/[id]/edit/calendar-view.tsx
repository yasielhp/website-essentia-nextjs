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
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  fullyBlockedDates,
  loadingMonth,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  fullyBlockedDates: Set<string>;
  loadingMonth: boolean;
}) {
  const today = new Date();
  const days = getCalendarDays(viewYear, viewMonth);
  const startColumn = getCalendarStartColumn(viewYear, viewMonth);

  const tCal = useTranslations("dashboard.common");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label={tCal("prevMonth")}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <p className="text-petroleum-700 text-sm font-semibold tracking-wide">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          {loadingMonth && (
            <span className="border-petroleum-300 size-3 animate-spin rounded-full border border-t-transparent" />
          )}
        </div>
        <button
          type="button"
          onClick={onNextMonth}
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
          const baseAvailable = isAvailableDay(day);
          const isBlocked =
            baseAvailable && fullyBlockedDates.has(localDateStr(day));
          const available = baseAvailable && !isBlocked;
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
