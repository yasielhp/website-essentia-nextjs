"use client";

import type { CalendarEvent } from "@/types/calendar";

export function EventPill({
  event,
  compact,
  onClick,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick: () => void;
}) {
  const bg = event.color + "22";
  const fg = event.color;

  if (compact) {
    return (
      <button
        onClick={onClick}
        style={{ backgroundColor: bg, color: fg }}
        className="mb-0.5 w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-4 font-medium transition-opacity hover:opacity-75"
      >
        {event.time && (
          <span className="mr-1 opacity-60">{event.time.slice(0, 5)}</span>
        )}
        {event.title}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{ backgroundColor: bg, color: fg }}
      className="mb-1.5 w-full rounded-xl px-3 py-2 text-left text-xs transition-opacity hover:opacity-75"
    >
      {event.time && (
        <div className="mb-0.5 font-semibold">{event.time.slice(0, 5)}</div>
      )}
      <div className="truncate font-medium">{event.title}</div>
      {event.subtitle && (
        <div className="truncate opacity-70">{event.subtitle}</div>
      )}
    </button>
  );
}
