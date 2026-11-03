import { getAdminClient } from "@/lib/insforge-admin";
import { paymentSettingsSchema } from "@/lib/schemas";
import {
  DEFAULT_PAYMENT_SETTINGS,
  type PaymentSettings,
} from "@/lib/payments/amounts";

/**
 * SERVER ONLY. One row per key in `app_settings`; a missing or malformed row
 * falls back to the defaults so a bad edit cannot take the booking form down.
 * The same fallback covers the window before the migration has been applied.
 */
export async function readPaymentSettings(): Promise<PaymentSettings> {
  const { data } = await getAdminClient()
    .database.from("app_settings")
    .select("value")
    .eq("key", "payments")
    .maybeSingle();
  const parsed = paymentSettingsSchema.safeParse(
    (data as { value: unknown } | null)?.value,
  );
  return parsed.success ? parsed.data : DEFAULT_PAYMENT_SETTINGS;
}

export async function writePaymentSettings(
  value: PaymentSettings,
  userId: string,
): Promise<void> {
  const { error } = await getAdminClient().database.from("app_settings").upsert(
    {
      key: "payments",
      value,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}
