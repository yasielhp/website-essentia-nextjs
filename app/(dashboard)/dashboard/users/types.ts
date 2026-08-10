/** A row of the user list, whoever they are underneath. */
export type DisplayRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  role: string;
  created_at: string | null;
  href: string;
};
