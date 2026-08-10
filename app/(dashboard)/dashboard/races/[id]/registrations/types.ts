/** The race, its entrants, and the people the add dialog searches. */
export type Race = {
  id: string;
  title: string;
  date: string | null;
  max_participants: number | null;
};

export type Registration = {
  id: string;
  contact_id: string | null;
  profile_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  registered_at: string;
  table_number: number | null;
  checked_in_at: string | null;
};

export type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};
