"use server";

import { createProviderFromEnv } from "@/lib/payments";

export async function createBookingCheckout(
  bookingId: string,
  opts: {
    amount: number;
    currency: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  },
) {
  const provider = createProviderFromEnv();
  if (!provider) {
    throw new Error(
      "No payment provider configured. Set PAYMENT_PROVIDER in your environment.",
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const session = await provider.createCheckoutSession({
    amount: opts.amount,
    currency: opts.currency,
    description: opts.description,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
    metadata: {
      bookingId,
      notifyUrl: appUrl ? `${appUrl}/api/webhooks/redsys` : "",
    },
  });

  return { id: session.id, url: session.url, provider: session.provider };
}
