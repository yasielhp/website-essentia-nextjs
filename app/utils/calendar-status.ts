import type { CSSProperties } from "react";
import type { CalendarEvent } from "@/types/calendar";

/**
 * Which bookings are appointments, for the dashboard calendar, and how the one
 * that is not done yet looks. Pure.
 *
 * A DRAFT is a public form abandoned before the deposit (some for weeks): it
 * holds no appointment. A CANCELLED booking is no appointment either. Neither is
 * asked for or drawn. Every other status is a booking that stands: `pending`
 * (it waits for the client's payment or for the team) is drawn apart so it is
 * not read as a done one; `confirmed`, `paid` and `completed` are drawn as
 * always. The payment MODE is not the status: a confirmed booking the client
 * pays at the centre is confirmed.
 */
export const HIDDEN_BOOKING_STATUSES = ["draft", "cancelled"] as const;

/** Whether a booking with this status is drawn. A missing status is: nothing is lost over a missing word. */
export function isDrawnBooking(status: string | null | undefined): boolean {
  return !(HIDDEN_BOOKING_STATUSES as readonly string[]).includes(status ?? "");
}

/** A booking that waits for payment or for the team. */
export function isPendingEvent(event: CalendarEvent): boolean {
  return event.type === "booking" && event.status === "pending";
}

/**
 * The colours of an event's block. The tint of its colour, as always; a pending
 * booking keeps the colour and gets a dashed outline and diagonal stripes in
 * it. The outline is drawn inside the box, so the block does not change size.
 */
export function eventStyle(event: CalendarEvent): CSSProperties {
  if (!isPendingEvent(event)) {
    return { backgroundColor: event.color + "22", color: event.color };
  }
  return {
    backgroundColor: event.color + "0d",
    backgroundImage: `repeating-linear-gradient(135deg, ${event.color}26 0 5px, transparent 5px 10px)`,
    color: event.color,
    outline: `1px dashed ${event.color}`,
    outlineOffset: "-1px",
  };
}
