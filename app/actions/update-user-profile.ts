"use server";

import { createClient } from "@insforge/sdk";

type UpdateUserProfileInput = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "admin" | "staff" | "partner";
  currentEmail: string;
};

export async function updateUserProfile(
  input: UpdateUserProfileInput,
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

  const { userId, email, firstName, lastName, phone, role, currentEmail } =
    input;
  const trimEmail = email.trim().toLowerCase();
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

  // Sync auth.users email if it changed (requires admin_update_user_email SQL function)
  const emailChanged = trimEmail && trimEmail !== currentEmail.trim().toLowerCase();
  if (emailChanged) {
    const { error: emailError } = await admin.database.rpc(
      "admin_update_user_email",
      { p_user_id: userId, p_new_email: trimEmail },
    );
    if (emailError) {
      // RPC not available — profile email will be updated but login email must be
      // changed manually from the Insforge Authentication panel
      console.warn("admin_update_user_email RPC failed:", emailError);
    }
  }

  // Update profile record
  const { error: profileError } = await admin.database
    .from("profiles")
    .update({
      role,
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      full_name: fullName,
      email: trimEmail || null,
      phone: phone.trim() || null,
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
