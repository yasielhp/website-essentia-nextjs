/** One person on the start list, as the check-in screen needs them. */
export type Registration = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  table_number: number | null;
  checked_in_at: string | null;
};

export type SearchResult = Registration & { matchScore: number };
