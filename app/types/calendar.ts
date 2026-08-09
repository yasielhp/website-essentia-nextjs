export type CalendarView = "month" | "week" | "day";

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  title: string;
  subtitle?: string;
  /** Everything the pill has no room for, shown on hover. */
  tooltip?: string;
  /** Booking status, rendered as its badge in the hover card. */
  status?: string;
  color: string;
  /** Empty for `busy` events: they are not navigable. */
  href: string;
  type: "booking" | "race" | "session" | "busy";
};

/**
 * An occupied slot stripped of everything that identifies the client.
 * Partners see these instead of the bookings they are not allowed to read.
 */
export type BusySlot = {
  date: string; // YYYY-MM-DD
  time: string | null;
  duration: string | null;
  /** Colleague who owns the slot, or null when only "busy" can be said. */
  bookedBy: string | null;
};
