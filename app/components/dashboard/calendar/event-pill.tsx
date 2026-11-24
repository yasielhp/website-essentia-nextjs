"use client";

import type { CalendarEvent } from "@/types/calendar";
import { eventStyle } from "@/utils/calendar-status";
import { PendingNote, pendingTitle } from "./pending-note";

export function EventPill({
  event,
  compact,
  onClick,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick: () => void;
}) {
  // A click opens the booking in the side sheet, which is where the rest of
  // it lives: the pill carries no hover card of its own.
  // A booking that waits for payment or the team keeps its colour but is drawn
  // dashed and striped (`eventStyle`), says so on hover and to a screen reader.
  const style = eventStyle(event);
  const title = pendingTitle(event);
  // Busy blocks stand in for bookings the viewer may not open, so they render
  // as plain divs — nothing to point at, nothing to click.
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
        <PendingNote event={event} />
      </>
    );

    return (
      <>
        {busy ? (
          <div style={style} className={className}>
            {body}
          </div>
        ) : (
          <button
            type="button"
            onClick={onClick}
            title={title}
            style={style}
            className={`${className} cursor-pointer transition-opacity hover:opacity-75`}
          >
            {body}
          </button>
        )}
      </>
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
      <PendingNote event={event} />
    </>
  );

  return (
    <>
      {busy ? (
        <div style={style} className={className}>
          {body}
        </div>
      ) : (
        <button
          type="button"
          onClick={onClick}
          title={title}
          style={style}
          className={`${className} cursor-pointer transition-opacity hover:opacity-75`}
        >
          {body}
        </button>
      )}
    </>
  );
}
