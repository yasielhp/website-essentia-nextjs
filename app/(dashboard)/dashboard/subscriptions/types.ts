/** A membership row, as the page and its table read it. */
export type Subscription = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};
