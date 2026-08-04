import type { UserRole } from "@/types";

/** Roles that can be assigned to a dashboard user from the admin UI. */
export type AssignableRole = Extract<UserRole, "admin" | "staff" | "partner">;

/** Payload accepted by the admin "edit user" form. */
export type UpdateUserProfileInput = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: AssignableRole;
  currentEmail: string;
};

/** A profile row as read from the database. */
export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole | null;
  newsletter_subscribed: boolean | null;
  created_at: string | null;
};
