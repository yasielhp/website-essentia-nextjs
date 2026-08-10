/** A session, as the list and the page both read it. */
export type AccessType = "members_only" | "open" | "paid" | "paid_members_free";

export type Session = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  duration_minutes: number | null;
  location: string | null;
  max_participants: number | null;
  image_url: string | null;
  access: AccessType;
  registrations_count: number;
};
