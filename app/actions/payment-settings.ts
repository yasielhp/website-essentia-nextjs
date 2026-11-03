"use server";

import { ADMIN_ROLES, requireRole } from "@/lib/auth-guard";
import { paymentSettingsSchema } from "@/lib/schemas";
import {
  readPaymentSettings,
  writePaymentSettings,
} from "@/lib/settings/app-settings";
import type { PaymentSettings } from "@/lib/payments/amounts";

/**
 * Public on purpose: the booking form shows "50% now" and "−5% if you pay
 * everything" before anybody is signed in. Nothing secret in it.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function getPublicPaymentSettings(): Promise<PaymentSettings> {
  return readPaymentSettings();
}

export async function savePaymentSettings(
  accessToken: string | null,
  input: PaymentSettings,
): Promise<{ error: string | null }> {
  const { userId } = await requireRole(accessToken, ADMIN_ROLES);
  const parsed = paymentSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  await writePaymentSettings(parsed.data, userId);
  return { error: null };
}
