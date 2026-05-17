"use server";

export async function getStripeStatus(): Promise<{
  connected: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  hasPublishableKey: boolean;
}> {
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  const hasPublishableKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const connected =
    process.env.PAYMENT_PROVIDER === "stripe" &&
    hasSecretKey &&
    hasWebhookSecret;

  return { connected, hasSecretKey, hasWebhookSecret, hasPublishableKey };
}
