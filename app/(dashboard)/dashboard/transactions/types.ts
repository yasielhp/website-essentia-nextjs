/** A payment, whatever it was for. */
export type TxType = "booking" | "membership" | "race" | "education";

export type UnifiedRow = {
  id: string;
  type: TxType;
  title: string;
  subtitle: string | null;
  client: string;
  clientEmail: string | null;
  reservedBy: string | null;
  date: string | null;
  /** Money received; for older bookings, the price they were booked at. */
  amount: number | null;
  /** The agreed price when it differs from what was received (a deposit). */
  listAmount?: number | null;
  /** Still to collect at the centre; 0 for everything but live bookings. */
  owed?: number;
  status: string | null;
  created_at: string | null;
};
