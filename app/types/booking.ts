/** Booking domain types shared by the dashboard, the public flow and actions. */

export type BookingStatus =
  "draft" | "pending" | "confirmed" | "cancelled" | "completed" | "paid";

export type PaymentStatus =
  "pending" | "deposit_paid" | "paid" | "failed" | "refunded";

/** How the client chose to pay; `bonus` and `none` are set from the dashboard. */
export type BookingPaymentMode = "deposit" | "full" | "bonus" | "none";

/** How money taken at the counter was handed over. */
export type BalanceMethod = "cash" | "card" | "transfer" | "other";

/** Payload accepted by the dashboard's full booking edit form. */
export type UpdateBookingPayload = {
  service_id: string;
  /** Who performs it, or null when the centre has not allocated anybody yet. */
  staff_id?: string | null;
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

/** What the public cancellation page needs, and nothing that identifies anyone else. */
export type CancellableBooking = {
  serviceTitle: string | null;
  sessionType: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
  status: string | null;
  firstName: string | null;
  /** False once the session is inside the free-cancellation window. */
  cancellable: boolean;
  alreadyCancelled: boolean;
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
  payment_mode: BookingPaymentMode | null;
  amount_paid_eur: number | null;
  balance_settled_at: string | null;
  balance_settled_method: BalanceMethod | null;
  google_event_id: string | null;
  contact_id: string | null;
  user_id: string | null;
  created_at: string | null;
};
