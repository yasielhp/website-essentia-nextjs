/** The session, the people on it, and the people the add dialog searches. */
export type Session = {
  id: string;
  title: string;
  date: string;
  max_participants: number | null;
};

export type Enrollee = {
  id: string;
  contact_id: string | null;
  profile_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  registered_at: string;
};

export type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};
