import type { Gender } from "@/types/person";

/** Contact directory types shared by the dashboard and the contacts actions. */

/**
 * The lifecycle the dashboard shows in its Role column.
 *
 * `member` marks someone entitled to a subscription; the subscription itself
 * is a row in `memberships`. The two are separate on purpose — you are marked a
 * member before a plan is attached, and the plan can lapse without the mark
 * changing.
 */
export type ContactStatus = "lead" | "client" | "member";

export type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  status: string | null;
  created_at: string | null;
};

export type ContactDetail = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  newsletter_subscribed: boolean | null;
  preferred_language: string | null;
};

export type ContactBooking = {
  id: string;
  service_title: string | null;
  duration: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  location_address: string | null;
  status: string | null;
  payment_status: string | null;
  price_eur: number | null;
  created_by_role: string | null;
  created_at: string | null;
};

export type ContactMembership = {
  id: string;
  plan: string | null;
  status: string | null;
  start_date: string | null;
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
      memberships: ContactMembership[];
      raceRegs: ContactRaceReg[];
      eduRegs: ContactEduReg[];
    };

export type UpdateContactPayload = {
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  preferred_language: string;
  newsletter_subscribed: boolean;
};
