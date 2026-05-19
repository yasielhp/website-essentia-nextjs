"use client";

import type { CalendarEvent } from "@/types/calendar";
import { toYMD, sortByTime } from "@/utils/dashboard-calendar";
import { TIME_SLOTS } from "@/constants/booking";

export function DayList({
  anchor,
  eventsByDay,
  loading,
  onEventClick,
  onSlotClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (time: string) => void;
}) {
  const ymd = toYMD(anchor);
  const dayEvents = sortByTime(eventsByDay.get(ymd) ?? []);

  const eventsByTime = new Map<string, CalendarEvent[]>();
  for (const e of dayEvents) {
    if (e.time) {
      const bucket = eventsByTime.get(e.time) ?? [];
      bucket.push(e);
      eventsByTime.set(e.time, bucket);
    }
  }

  const allDayEvents = dayEvents.filter((e) => !e.time);

  return (
    <div className="py-2">
      {loading ? (
        <div className="space-y-1 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-1">
              <div className="bg-sand-100 h-4 w-10 animate-pulse rounded" />
              <div className="bg-sand-100 h-10 flex-1 animate-pulse rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div>
          {/* All-day events (no time) */}
          {allDayEvents.length > 0 && (
            <div className="border-sand-100 border-b px-4 py-2">
              <div className="text-petroleum-400 mb-1.5 text-xs font-medium">
                All day
              </div>
              <div className="space-y-1">
                {allDayEvents.map((e) => (
                  <button
                    key={e.id + e.type}
                    onClick={() => onEventClick(e)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-opacity hover:opacity-75"
                    style={{ backgroundColor: e.color + "22", color: e.color }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {e.title}
                      </div>
                      {e.subtitle && (
                        <div className="truncate text-xs opacity-70">
                          {e.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time slots */}
          <div>
            {TIME_SLOTS.map((slot) => {
              const slotEvents = eventsByTime.get(slot) ?? [];
              return slotEvents.length > 0 ? (
                <div
                  key={slot}
                  className="border-sand-100 flex min-h-12 border-b last:border-b-0"
                >
                  <div className="text-petroleum-400 w-16 shrink-0 py-2 pr-3 text-right font-mono text-xs">
                    {slot}
                  </div>
                  <div className="flex flex-1 items-start gap-1.5 py-1.5 pr-4">
                    {slotEvents.map((e) => (
                      <button
                        key={e.id + e.type}
                        onClick={() => onEventClick(e)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-1.5 text-left text-xs transition-opacity hover:opacity-75"
                        style={{
                          backgroundColor: e.color + "22",
                          color: e.color,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{e.title}</div>
                          {e.subtitle && (
                            <div className="truncate opacity-70">
                              {e.subtitle}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  key={slot}
                  onClick={() => onSlotClick(slot)}
                  className="border-sand-100 hover:bg-sand-50 flex min-h-12 w-full border-b text-left transition-colors last:border-b-0"
                  aria-label={`New booking at ${slot}`}
                >
                  <div className="text-petroleum-400 w-16 shrink-0 py-2 pr-3 text-right font-mono text-xs">
                    {slot}
                  </div>
                  <div className="flex-1 pr-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
