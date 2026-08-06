"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";
import { publicEnv, serverEnv } from "@/lib/env";
import type { UpdateUserProfileInput } from "@/types/user";

/**
 * Updates a staff profile, optionally changing the auth email. Admin only.
 *
 * This action can grant the `admin` role, so an unauthenticated caller could
 * previously promote themselves. The role check is the whole point.
 */
export async function updateUserProfile(
  accessToken: string | null,
  input: UpdateUserProfileInput,
): Promise<{ error: string | null }> {
  try {
    await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  const {
    userId,
    email,
    firstName,
    lastName,
    phone,
    gender,
    preferredLanguage,
    role,
    currentEmail,
  } = input;

  if (!userId) return { error: "Falta el identificador del usuario." };

  const trimEmail = email.trim().toLowerCase();
  const fullName = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");

  // Sync auth.users email via the Insforge admin REST API (GoTrue-compatible)
  const emailChanged =
    trimEmail && trimEmail !== currentEmail.trim().toLowerCase();
  if (emailChanged) {
    const serviceKey = serverEnv.insforgeServiceKey;
    const baseUrl = publicEnv.insforgeUrl.replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ email: trimEmail, email_confirm: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        error: `Error al actualizar el email de autenticación: ${body}`,
      };
    }
  }

  const { error: profileError } = await getAdminClient()
    .database.from("profiles")
    .update({
      role,
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      full_name: fullName,
      email: trimEmail || null,
      phone: phone.trim() || null,
      gender,
      preferred_language: preferredLanguage,
    })
    .eq("id", userId);

  if (profileError) {
    return {
      error:
        (profileError as { message?: string }).message ??
        "Error al actualizar el perfil.",
    };
  }

  return { error: null };
}
