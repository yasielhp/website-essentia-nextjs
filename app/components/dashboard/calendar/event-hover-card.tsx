"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { CalendarEvent } from "@/types/calendar";
import { StatusBadge } from "@/components/dashboard/booking-cells";

/**
 * What a month cell has no room for, shown on hover.
 *
 * Rendered in a portal at fixed coordinates so a card near the bottom of the
 * grid is not clipped by the cell's `overflow`. Pointer devices only: on touch
 * there is no hover, and the pill opens the booking anyway.
 */
/** Tracks the hovered element's box, which is where the card is anchored. */
export function useHoverAnchor(enabled: boolean) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const props = enabled
    ? {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
          setAnchor(e.currentTarget.getBoundingClientRect()),
        onMouseLeave: () => setAnchor(null),
      }
    : {};
  return { anchor, props };
}

export function EventHoverCard({
  event,
  anchor,
}: {
  event: CalendarEvent;
  anchor: DOMRect;
}) {
  // Only ever mounted in response to a mouse event, so `document` is there.
  if (!event.tooltip) return null;

  const [heading, ...rest] = event.tooltip.split("\n");

  // Flip above the pill when there is no room below, and keep the card inside
  // the viewport horizontally.
  const WIDTH = 260;
  const below = anchor.bottom + 8;
  const flip = below + 160 > window.innerHeight;
  const left = Math.min(
    Math.max(8, anchor.left),
    Math.max(8, window.innerWidth - WIDTH - 8),
  );

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        top: flip ? undefined : below,
        bottom: flip ? window.innerHeight - anchor.top + 8 : undefined,
        left,
        width: WIDTH,
        borderTopColor: event.color,
      }}
      className="border-sand-200 pointer-events-none z-[9999] rounded-xl border border-t-4 bg-white p-3 shadow-lg"
    >
      {heading && (
        <p className="text-petroleum-400 text-xs font-medium">{heading}</p>
      )}
      {rest.map((line, i) => (
        <p
          key={line + i}
          className={
            i === 0
              ? "text-petroleum-700 mt-0.5 text-sm font-medium"
              : "text-petroleum-500 mt-0.5 text-xs"
          }
        >
          {line}
        </p>
      ))}
      {event.status && (
        <div className="mt-2">
          <StatusBadge status={event.status} />
        </div>
      )}
    </div>,
    document.body,
  );
}
