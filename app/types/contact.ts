/** Contact directory types shared by the dashboard and the contacts actions. */

export type ContactStatus = "lead" | "client";

export type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string | null;
};

export type ContactDetail = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  newsletter_subscribed: boolean | null;
  preferred_language: string | null;
};

export type ContactBooking = {
  id: string;
  service_title: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  created_at: string | null;
};

export type ContactRaceReg = {
  id: string;
  created_at: string | null;
  race_id: string;
  race: {
    title: string | null;
    date: string | null;
    location: string | null;
  } | null;
};

export type ContactEduReg = {
  id: string;
  created_at: string | null;
  session_id: string;
  session: {
    title: string | null;
    date: string | null;
    location: string | null;
  } | null;
};

export type ContactDetailResult =
  | { found: false }
  | {
      found: true;
      contact: ContactDetail;
      bookings: ContactBooking[];
      raceRegs: ContactRaceReg[];
      eduRegs: ContactEduReg[];
    };

export type UpdateContactPayload = {
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_language: string;
  newsletter_subscribed: boolean;
};
