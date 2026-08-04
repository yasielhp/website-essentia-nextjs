"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import type { RedsysStatus } from "@/types/payments";

/**
 * Reports whether the Redsys gateway is configured. Staff only — this describes
 * the deployment's payment configuration and should not be world-readable.
 */
export async function getRedsysStatus(
  accessToken: string | null,
): Promise<RedsysStatus> {
  const unknown: RedsysStatus = {
    connected: false,
    hasMerchantCode: false,
    hasSecretKey: false,
    environment: "test",
  };

  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return unknown;
    throw err;
  }

  const hasMerchantCode = !!process.env.REDSYS_MERCHANT_CODE;
  const hasSecretKey = !!process.env.REDSYS_SECRET_KEY;
  const environment =
    (process.env.REDSYS_ENVIRONMENT as "test" | "live") ?? "test";
  const connected =
    process.env.PAYMENT_PROVIDER === "redsys" &&
    hasMerchantCode &&
    hasSecretKey;

  return { connected, hasMerchantCode, hasSecretKey, environment };
}
