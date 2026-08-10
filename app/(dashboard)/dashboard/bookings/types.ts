/** A booking, as the list screen reads it. */
export type Booking = {
  id: string;
  service_title: string | null;
  duration: string | null;
  tier_id: string | null;
  service_tiers: { label: string | null; color: string | null } | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  location: string | null;
  location_address: string | null;
  created_at: string | null;
  created_by_role: string | null;
  created_by_user_id: string | null;
};
