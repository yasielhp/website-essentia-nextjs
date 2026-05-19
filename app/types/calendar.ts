export type CalendarView = "month" | "week" | "day";

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  title: string;
  subtitle?: string;
  color: string;
  href: string;
  type: "booking" | "race" | "session";
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
