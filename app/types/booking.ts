/** Booking domain types shared by the dashboard, the public flow and actions. */

export type BookingStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "paid";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

/** Payload accepted by the dashboard's full booking edit form. */
export type UpdateBookingPayload = {
  service_id: string;
  service_title: string;
  tier_id: string | null;
  price_eur: number | null;
  duration: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  location_address: string | null;
  notes: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
};

/** A booking row as read from the database. */
export type Booking = {
  id: string;
  service_id: string | null;
  service_title: string | null;
  tier_id: string | null;
  price_eur: number | null;
  duration: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  location_address: string | null;
  notes: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  payment_status: string | null;
  google_event_id: string | null;
  contact_id: string | null;
  user_id: string | null;
  created_at: string | null;
};
