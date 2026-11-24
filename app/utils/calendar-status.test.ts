import { describe, expect, test } from "bun:test";
import type { CalendarEvent } from "@/types/calendar";
import {
  HIDDEN_BOOKING_STATUSES,
  eventStyle,
  isDrawnBooking,
  isPendingEvent,
} from "./calendar-status";

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "b-1",
  date: "2026-11-24",
  time: "10:30",
  title: "Ana",
  color: "#0284c7",
  href: "/dashboard/bookings/b-1",
  type: "booking",
  status: "confirmed",
  ...over,
});

describe("which bookings the calendar draws", () => {
  test("a draft (a public form abandoned before the deposit) and a cancelled booking are not appointments", () => {
    expect([...HIDDEN_BOOKING_STATUSES].sort()).toEqual(["cancelled", "draft"]);
    expect(isDrawnBooking("draft")).toBe(false);
    expect(isDrawnBooking("cancelled")).toBe(false);
  });

  test("every other status is: pending (it waits for payment or the team), confirmed, paid, completed", () => {
    for (const status of ["pending", "confirmed", "paid", "completed"]) {
      expect(isDrawnBooking(status)).toBe(true);
    }
  });

  test("a booking with no status is drawn: the calendar never loses an appointment over a missing word", () => {
    expect(isDrawnBooking(null)).toBe(true);
    expect(isDrawnBooking(undefined)).toBe(true);
  });
});

describe("isPendingEvent", () => {
  test("only a booking whose status is pending", () => {
    expect(isPendingEvent(event({ status: "pending" }))).toBe(true);
    for (const status of ["confirmed", "paid", "completed", undefined]) {
      expect(isPendingEvent(event({ status }))).toBe(false);
    }
  });

  test("a race, a session or a busy block is never 'pending', whatever it carries", () => {
    for (const type of ["race", "session", "busy"] as const) {
      expect(isPendingEvent(event({ type, status: "pending" }))).toBe(false);
    }
  });

  test("a confirmed booking the client will pay at the centre is confirmed, not pending", () => {
    // The payment mode is not the status: the calendar reads the status only.
    expect(isPendingEvent(event({ status: "confirmed" }))).toBe(false);
  });
});

describe("eventStyle", () => {
  test("a normal booking is the soft tint of its colour, as before", () => {
    expect(eventStyle(event())).toEqual({
      backgroundColor: "#0284c722",
      color: "#0284c7",
    });
  });

  test("a pending one keeps its colour but is drawn apart: a dashed outline in the colour, and stripes instead of a flat tint", () => {
    const style = eventStyle(event({ status: "pending" }));
    expect(style.color).toBe("#0284c7");
    expect(style.outline).toBe("1px dashed #0284c7");
    expect(style.outlineOffset).toBe("-1px");
    expect(String(style.backgroundImage)).toContain(
      "repeating-linear-gradient",
    );
    expect(String(style.backgroundImage)).toContain("#0284c7");
    // The outline sits inside the box: it takes no room, so the pill keeps its size.
    expect(style).not.toHaveProperty("border");
  });

  test("it works for any colour the type has", () => {
    expect(
      eventStyle(event({ status: "pending", color: "#d97706" })).outline,
    ).toBe("1px dashed #d97706");
  });
});
