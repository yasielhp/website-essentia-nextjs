"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";

/** Demotes a user to `contact`, revoking dashboard access. Admin only. */
export async function removeUserAccess(
  accessToken: string | null,
  userId: string,
): Promise<{ error: string | null }> {
  let caller;
  try {
    caller = await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!userId) return { error: "Falta el identificador del usuario." };
  if (userId === caller.userId) {
    return { error: "No puedes revocar tu propio acceso." };
  }

  const { error } = await getAdminClient()
    .database.from("profiles")
    .update({ role: "contact" })
    .eq("id", userId);

  if (error) {
    return {
      error:
        (error as { message?: string }).message ??
        "Error al eliminar el acceso del usuario.",
    };
  }

  return { error: null };
}
