"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";

/**
 * Deletes a contact and every record that hangs off it. Admin only.
 *
 * This cascades into bookings and registrations, so it is the most destructive
 * action in the app — it is restricted to administrators rather than all staff.
 */
export async function deleteContact(
  accessToken: string | null,
  contactId: string,
): Promise<{ error: string | null }> {
  try {
    await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!contactId) return { error: "Falta el identificador del contacto." };

  const admin = getAdminClient();

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
