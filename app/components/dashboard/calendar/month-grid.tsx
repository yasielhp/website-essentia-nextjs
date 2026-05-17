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
    <div className="overflow-x-auto">
      <div className="min-w-140">
        {/* Day headers */}
        <div className="border-sand-200 grid grid-cols-7 border-b">
          {DAYS_SHORT.map((d) => (
            <div
              key={d}
              className="text-petroleum-400 py-2 text-center text-xs font-medium"
            >
              {d}
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
                className={`border-sand-100 min-h-22 border-r border-b p-1.5 ${
                  !isCurrentMonth ? "bg-sand-50/60" : ""
                }`}
              >
                <button
                  onClick={() => onDayClick(day)}
                  className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    isToday
                      ? "bg-petroleum-700 text-white"
                      : isCurrentMonth
                        ? "text-petroleum-700 hover:bg-sand-100"
                        : "text-petroleum-300 hover:bg-sand-100"
                  }`}
                >
                  {day.getDate()}
                </button>

                {loading ? (
                  day.getDate() % 3 === 0 && isCurrentMonth ? (
                    <div className="bg-sand-200 mb-0.5 h-3.5 animate-pulse rounded" />
                  ) : null
                ) : (
                  <>
                    {dayEvents.slice(0, 2).map((e) => (
                      <EventPill
                        key={e.id + e.type}
                        event={e}
                        compact
                        onClick={() => onEventClick(e)}
                      />
                    ))}
                    {extra > 0 && (
                      <button
                        onClick={() => onDayClick(day)}
                        className="text-petroleum-400 hover:text-petroleum-700 text-[10px]"
                      >
                        +{extra} more
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
