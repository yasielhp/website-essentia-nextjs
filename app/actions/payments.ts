"use server";

import { createProviderFromEnv } from "@/lib/payments";
import { insforge } from "@/lib/insforge";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";

export async function createBookingCheckout(
  bookingId: string,
  opts: {
    /** Stripe pre-registered price ID (preferred). */
    priceId?: string;
    /** Amount in cents, used when priceId is absent. */
    amount?: number;
    currency: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
    /** Pre-fills the email field in Stripe Checkout */
    customerEmail?: string;
    /** Pre-fills the customer name shown in Stripe Checkout */
    customerName?: string;
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
    priceId: opts.priceId,
    amount: opts.amount,
    currency: opts.currency,
    description: opts.description,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
    customerEmail: opts.customerEmail,
    customerName: opts.customerName,
    metadata: {
      bookingId,
      notifyUrl: appUrl ? `${appUrl}/api/webhooks/redsys` : "",
    },
  });

  return { id: session.id, url: session.url, provider: session.provider };
}

/** Called from the Stripe webhook when checkout.session.completed */
export async function handleBookingPaid(bookingId: string) {
  const { data: booking } = await insforge.database
    .from("bookings")
    .select("first_name, last_name, email, service_title, date, time, duration")
    .eq("id", bookingId)
    .single();

  if (!booking) return;

  await insforge.database
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("id", bookingId);

  const { error } = await sendEmail({
    to: booking.email as string,
    subject: "Your Essentia booking is confirmed",
    html: bookingConfirmationEmail({
      name: booking.first_name as string,
      serviceName: booking.service_title as string,
      date: new Date(booking.date as string).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      time: booking.time as string,
      duration: booking.duration as string,
    }),
  });

  if (error) {
    console.error("[handleBookingPaid] email failed:", error);
  }
}
