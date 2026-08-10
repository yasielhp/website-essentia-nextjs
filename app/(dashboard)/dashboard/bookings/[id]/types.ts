/** One booking as this screen reads it, and whoever made it. */
export type BookingDetail = {
  id: string;
  service_title: string | null;
  duration: string | null;
  price_eur: number | null;
  tier_id: string | null;
  staff_id: string | null;
  payment_status: string | null;
  service_tiers: {
    label: string | null;
    image_url: string | null;
    color: string | null;
  } | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  location: string | null;
  location_address: string | null;
  notes: string | null;
  created_at: string | null;
  created_by_role: string | null;
  created_by_user_id: string | null;
};

export type CreatorProfile = {
  full_name: string | null;
  email: string | null;
  role: string | null;
};

/** The professional performing a booking, as the detail screen shows them. */
export type StaffPerson = {
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
};
