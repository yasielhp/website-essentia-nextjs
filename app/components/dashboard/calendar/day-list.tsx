"use client";

import type { CalendarEvent } from "@/types/calendar";
import { toYMD, sortByTime } from "@/utils/dashboard-calendar";

export function DayList({
  anchor,
  eventsByDay,
  loading,
  onEventClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const ymd = toYMD(anchor);
  const dayEvents = sortByTime(eventsByDay.get(ymd) ?? []);

  const TYPE_LABEL: Record<CalendarEvent["type"], string> = {
    booking: "Booking",
    race: "Race",
    session: "Session",
  };

  return (
    <div className="py-3">
      {loading ? (
        <div className="space-y-2 px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-sand-100 h-16 animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : dayEvents.length === 0 ? (
        <div className="text-petroleum-300 py-16 text-center text-sm">
          Nothing scheduled.
        </div>
      ) : (
        <div className="space-y-2 px-4">
          {dayEvents.map((e) => (
            <button
              key={e.id + e.type}
              onClick={() => onEventClick(e)}
              className="border-sand-200 hover:bg-sand-50 flex w-full items-center gap-4 rounded-xl border bg-white px-4 py-3 text-left transition-colors"
            >
              <div
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: e.color }}
              />
              <div className="text-petroleum-500 w-12 shrink-0 font-mono text-sm">
                {e.time ?? "—"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-petroleum-700 truncate font-medium">
                  {e.title}
                </div>
                {e.subtitle && (
                  <div className="text-petroleum-400 truncate text-xs">
                    {e.subtitle}
                  </div>
                )}
              </div>
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: e.color + "22", color: e.color }}
              >
                {TYPE_LABEL[e.type]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
