"use server";

import { createClient } from "@insforge/sdk";

export async function setUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  const serviceKey = process.env.INSFORGE_SERVICE_KEY;
  if (!serviceKey) {
    return { error: "INSFORGE_SERVICE_KEY no está configurada." };
  }

  const admin = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: serviceKey,
    isServerMode: true,
  });

  const { error } = await admin.database.rpc("admin_set_user_password", {
    p_user_id: userId,
    p_new_password: newPassword,
  });

  if (error) {
    return {
      error:
        (error as { message?: string }).message ??
        "Error al actualizar la contraseña.",
    };
  }

  return { error: null };
}
