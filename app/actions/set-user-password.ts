"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, authenticate } from "@/lib/auth-guard";

/**
 * Sets a user's password.
 *
 * Allowed for administrators (resetting any account) and for any signed-in user
 * changing their own password. `accessToken` is the caller's Insforge access
 * token: Server Actions are public HTTP endpoints, so without this check anyone
 * could reset an administrator's password. See `app/lib/auth-guard.ts`.
 */
export async function setUserPassword(
  accessToken: string | null,
  userId: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  let caller;
  try {
    caller = await authenticate(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!userId) return { error: "Falta el identificador del usuario." };

  const isSelf = caller.userId === userId;
  if (!isSelf && caller.role !== "admin") {
    return { error: "No tienes permisos para cambiar esta contraseña." };
  }
  if (!newPassword || newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const { error } = await getAdminClient().database.rpc(
    "admin_set_user_password",
    { p_user_id: userId, p_new_password: newPassword },
  );

  if (error) {
    return {
      error:
        (error as { message?: string }).message ??
        "Error al actualizar la contraseña.",
    };
  }

  return { error: null };
}
