"use server";

import { createClient } from "@insforge/sdk";

export async function removeUserAccess(
  userId: string,
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

  const { error } = await admin.database
    .from("profiles")
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
