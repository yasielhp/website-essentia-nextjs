"use server";

export async function getRedsysStatus(): Promise<{
  connected: boolean;
  hasMerchantCode: boolean;
  hasSecretKey: boolean;
  environment: "test" | "live";
}> {
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
