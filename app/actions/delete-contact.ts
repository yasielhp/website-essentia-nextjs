"use server";

import { createClient } from "@insforge/sdk";

export async function deleteContact(
  contactId: string,
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

  await Promise.all([
    admin.database
      .from("race_registrations")
      .delete()
      .eq("contact_id", contactId),
    admin.database
      .from("education_registrations")
      .delete()
      .eq("contact_id", contactId),
    admin.database.from("bookings").delete().eq("contact_id", contactId),
  ]);

  const { error } = await admin.database
    .from("contacts")
    .delete()
    .eq("id", contactId);

  if (error) {
    return {
      error:
        (error as { message?: string }).message ??
        "Error al eliminar el contacto.",
    };
  }

  return { error: null };
}
