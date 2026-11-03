/** Bonus domain types shared by the dashboard screens and the actions. */

export type BonusPaidMethod = "cash" | "card" | "transfer" | "online" | "other";

/** A template: what a bonus of this kind is, sold to many clients. */
export type BonusPlan = {
  id: string;
  tierId: string;
  tierLabel: string | null;
  name: string;
  sessions: number;
  priceEur: number;
  validityDays: number;
  active: boolean;
  sellOnline: boolean;
};

/** A booking that drew a session from a bonus. */
export type BonusBooking = {
  id: string;
  date: string | null;
  time: string | null;
  status: string | null;
};

/** One bonus a client bought, with its sessions counted from their bookings. */
export type ContactBonus = {
  id: string;
  planId: string | null;
  tierId: string;
  tierLabel: string | null;
  name: string;
  sessionsTotal: number;
  priceEur: number;
  paidMethod: BonusPaidMethod | null;
  purchasedAt: string;
  expiresAt: string;
  notes: string | null;
  used: number;
  remaining: number;
  bookings: BonusBooking[];
};
