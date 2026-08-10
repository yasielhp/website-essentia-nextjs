/** A race, as the list and the page both read it. */
export type RaceAccess = "members" | "open";

export type Race = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  max_participants: number | null;
  image_url: string | null;
  access: RaceAccess;
  created_at: string | null;
  registrations_count: number;
};
