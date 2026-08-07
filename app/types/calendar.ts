export type CalendarView = "month" | "week" | "day";

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  title: string;
  subtitle?: string;
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

export type UpcomingRace = {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  image_url: string | null;
};

export type UpcomingSession = {
  id: string;
  title: string;
  date: string;
  location: string | null;
  speaker: string | null;
  duration_minutes: number | null;
  image_url: string | null;
};
