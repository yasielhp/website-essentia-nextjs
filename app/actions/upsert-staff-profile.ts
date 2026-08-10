"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";

/**
 * Writes the profile of a member of staff, role included.
 *
 * The "new user" screen used to upsert this row straight from the browser with
 * the anon client, `role` and all. Row-level security gates rows rather than
 * columns, so that write was only ever as safe as the policy on `profiles` —
 * and the policy let anyone edit their own row, whatever they put in `role`.
 * The database now refuses a self-promotion outright (see
 * `20260810c_profiles_role_is_not_self_service.sql`); this action is the other
 * half, so the privileged write happens where the caller's role is checked.
 */
export async function upsertStaffProfile(
  accessToken: string | null,
  profile: {
    id: string;
    role: "admin" | "staff" | "partner";
    firstName: string;
    lastName: string | null;
    fullName: string;
    email: string;
    phone: string | null;
    gender: string | null;
    preferredLanguage: string;
  },
): Promise<{ error: string | null }> {
  try {
    await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!profile.id) return { error: "Missing user id." };

  const { error } = await getAdminClient()
    .database.from("profiles")
    .upsert([
      {
        id: profile.id,
        role: profile.role,
        first_name: profile.firstName,
        last_name: profile.lastName,
        full_name: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        gender: profile.gender,
        preferred_language: profile.preferredLanguage,
      },
    ]);

  return { error: (error as { message?: string } | null)?.message ?? null };
}
