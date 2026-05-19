"use client";

import type { CalendarEvent } from "@/types/calendar";
import {
  toYMD,
  getWeekDays,
  sortByTime,
  DAYS_SHORT,
} from "@/utils/dashboard-calendar";
import { EventPill } from "./event-pill";

export function WeekGrid({
  anchor,
  eventsByDay,
  loading,
  onEventClick,
  onDayClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (d: Date) => void;
}) {
  const todayYMD = toYMD(new Date());
  const weekDays = getWeekDays(anchor);

  return (
    <div>
      {/* Day headers */}
      <div className="border-sand-200 grid grid-cols-7 border-b">
        {weekDays.map((day) => {
          const ymd = toYMD(day);
          const isToday = ymd === todayYMD;
          return (
            <div key={ymd} className="py-2 text-center">
              <div className="text-petroleum-400 text-xs">
                <span className="hidden sm:inline">
                  {DAYS_SHORT[(day.getDay() + 6) % 7]}
                </span>
                <span className="sm:hidden">
                  {DAYS_SHORT[(day.getDay() + 6) % 7]![0]}
                </span>
              </div>
              <button
                onClick={() => onDayClick(day)}
                className={`mx-auto mt-1 flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors sm:size-7 sm:text-sm ${
                  isToday
                    ? "bg-petroleum-700 text-white"
                    : "text-petroleum-700 hover:bg-sand-100"
                }`}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Columns */}
      <div className="grid min-h-80 grid-cols-7">
        {weekDays.map((day) => {
          const ymd = toYMD(day);
          const dayEvents = sortByTime(eventsByDay.get(ymd) ?? []);
          return (
            <div
              key={ymd}
              onClick={() => onDayClick(day)}
              className="border-sand-100 hover:bg-sand-50 cursor-pointer border-r p-0.5 transition-colors last:border-r-0 sm:p-1.5"
            >
              {loading ? (
                day.getDay() % 2 === 0 ? (
                  <div className="bg-sand-100 h-10 animate-pulse rounded-xl sm:h-14" />
                ) : null
              ) : (
                <div onClick={(e) => e.stopPropagation()}>
                  {dayEvents.map((e) => (
                    <EventPill
                      key={e.id + e.type}
                      event={e}
                      onClick={() => onEventClick(e)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
