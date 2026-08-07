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
  // Busy blocks stand in for bookings the viewer may not open, so they render
  // as plain divs — no hover affordance, nothing to click.
  const busy = event.type === "busy";

  if (compact) {
    const className =
      "mb-0.5 w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-4 font-medium";
    const body = (
      <>
        {event.time && (
          <span className="mr-1 opacity-60">{event.time.slice(0, 5)}</span>
        )}
        {event.title}
      </>
    );

    return busy ? (
      <div style={{ backgroundColor: bg, color: fg }} className={className}>
        {body}
      </div>
    ) : (
      <button
        onClick={onClick}
        style={{ backgroundColor: bg, color: fg }}
        className={`${className} transition-opacity hover:opacity-75`}
      >
        {body}
      </button>
    );
  }

  const className = "mb-1.5 w-full rounded-xl px-3 py-2 text-left text-xs";
  const body = (
    <>
      {event.time && (
        <div className="mb-0.5 font-semibold">{event.time.slice(0, 5)}</div>
      )}
      <div className="truncate font-medium">{event.title}</div>
      {event.subtitle && (
        <div className="truncate opacity-70">{event.subtitle}</div>
      )}
    </>
  );

  return busy ? (
    <div style={{ backgroundColor: bg, color: fg }} className={className}>
      {body}
    </div>
  ) : (
    <button
      onClick={onClick}
      style={{ backgroundColor: bg, color: fg }}
      className={`${className} transition-opacity hover:opacity-75`}
    >
      {body}
    </button>
  );
}
