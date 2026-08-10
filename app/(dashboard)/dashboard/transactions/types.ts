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
  amount: number | null;
  status: string | null;
  created_at: string | null;
};
