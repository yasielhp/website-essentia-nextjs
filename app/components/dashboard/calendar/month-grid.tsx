"use client";

import type { CalendarEvent } from "@/types/calendar";
import {
  toYMD,
  getCalendarGrid,
  sortByTime,
  DAYS_SHORT,
} from "@/utils/dashboard-calendar";
import { EventPill } from "./event-pill";

export function MonthGrid({
  anchor,
  eventsByDay,
  loading,
  onDayClick,
  onEventClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  loading: boolean;
  onDayClick: (d: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const todayYMD = toYMD(new Date());
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const grid = getCalendarGrid(year, month);

  return (
    <div>
      {/* Day headers */}
      <div className="border-sand-200 grid grid-cols-7 border-b">
        {DAYS_SHORT.map((d) => (
          <div
            key={d}
            className="text-petroleum-400 py-2 text-center text-xs font-medium"
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 overflow-hidden">
        {grid.map((day) => {
          const ymd = toYMD(day);
          const isCurrentMonth = day.getMonth() === month;
          const isToday = todayYMD !== "" && ymd === todayYMD;
          const dayEvents = sortByTime(eventsByDay.get(ymd) ?? []);
          const extra = dayEvents.length - 2;

          return (
            <div
              key={ymd}
              onClick={() => onDayClick(day)}
              className={`border-sand-100 hover:bg-sand-50 min-h-16 cursor-pointer border-r border-b p-0.5 transition-colors sm:min-h-22 sm:p-1.5 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0 ${
                !isCurrentMonth ? "bg-sand-50/60" : ""
              }`}
            >
              <span
                className={`mb-0.5 flex size-5 items-center justify-center rounded-full text-[10px] font-medium sm:mb-1 sm:size-6 sm:text-xs ${
                  isToday
                    ? "bg-petroleum-700 text-white"
                    : isCurrentMonth
                      ? "text-petroleum-700"
                      : "text-petroleum-300"
                }`}
              >
                {day.getDate()}
              </span>

              {loading ? (
                day.getDate() % 3 === 0 && isCurrentMonth ? (
                  <div className="bg-sand-200 mb-0.5 h-2 animate-pulse rounded sm:h-3.5" />
                ) : null
              ) : (
                <div onClick={(e) => e.stopPropagation()}>
                  {dayEvents.slice(0, 2).map((e) => (
                    <EventPill
                      key={e.id + e.type}
                      event={e}
                      compact
                      onClick={() => onEventClick(e)}
                    />
                  ))}
                  {extra > 0 && (
                    <span className="text-petroleum-400 text-[9px] sm:text-[10px]">
                      +{extra}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
