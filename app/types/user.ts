import type { UserRole } from "@/types";
import type { WeeklySchedule } from "@/types/schedule";
import type { Gender } from "@/types/person";

/** Roles that can be assigned to a dashboard user from the admin UI. */
export type AssignableRole = Extract<UserRole, "admin" | "staff" | "partner">;

/** Payload accepted by the admin "edit user" form. */
export type UpdateUserProfileInput = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: Gender | null;
  preferredLanguage: string;
  role: AssignableRole;
  currentEmail: string;
  /** Public URL of the profile photo, or null to clear it. */
  avatarUrl: string | null;
  /** What they do — "Fisioterapeuta", "Doctora". Staff only; null clears it. */
  jobTitle?: string | null;
  /** Working days and hours. Only sent for roles that take bookings. */
  schedule?: WeeklySchedule;
  slotIntervalMinutes?: number;
};

/** A profile row as read from the database. */
export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  gender: Gender | null;
  role: UserRole | null;
  newsletter_subscribed: boolean | null;
  created_at: string | null;
};
