import { type NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { getRedsysProvider } from "@/lib/payments";
import { getAppUrl } from "@/lib/env";
import { fullPaymentCharge } from "@/lib/payments/amounts";
import { readPaymentSettings } from "@/lib/settings/app-settings";
import { ALREADY_PAID, holdsMoney } from "@/lib/payments/checkout-order";
import { recordBookingEvent } from "@/lib/booking-events/record";
import { formatPrice } from "@/utils/format";
import { CLAIM_COOKIE, holdsClaim } from "@/lib/bookings/draft-claim";

type CheckoutBody = {
  bookingId: string;
  /**
   * Sent by forms built before 2026-11-24. NEVER read: the session type, and
   * so the price, are the booking's own (`bookings.tier_id`).
   */
  tierId?: unknown;
  email?: string;
  name?: string;
  description?: string;
  date?: string;
  time?: string;
  phone?: string;
  /**
   * Sent by forms built before 2026-11-24, which offered a deposit. Never read
   * for the amount: whatever it says, the whole price is charged.
   */
  paymentMode?: unknown;
};

/**
 * Creates a Redsys checkout for a booking.
 *
 * The amount is resolved from `service_tiers` and `app_settings.payments` on
 * the server and never from the request body. Trusting a client-supplied
 * `amountEur` allowed paying an arbitrary amount — one cent — for any service.
 * And the session type is the BOOKING's (`bookings.tier_id`), never the
 * request's: a `tierId` in the body let a booking for Lume (165 €) be paid as
 * Espira (70 €), and a booking taken at the desk at the suite price be
 * rewritten to the web price by its id.
 *
 * A checkout opens only on a booking of the public form that is waiting for
 * its payment (`pending`: not a draft, which holds no hour, not one taken at
 * the desk, which is `confirmed`), and only for the browser that wrote it: it
 * must hold the booking's claim (`draft-claim.ts`, a signed httpOnly cookie).
 *
 * Only the whole price is charged (since 2026-11-24 there is no deposit). A
 * page still open on the old form may ask for `paymentMode: "deposit"`: it is
 * not refused, it is charged the whole price like everybody else, and the bank
 * page shows that amount before the client pays anything. No request can open
 * a partial charge.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The answer to a browser that did not write this booking. */
const NOT_YOURS = "not_yours";
/** The answer to a booking that is not waiting for its payment. */
const NOT_OPEN = "not_open";

export async function POST(req: NextRequest) {
  const provider = getRedsysProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "Redsys not configured" },
      { status: 500 },
    );
  }

  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { bookingId, email, name, description, date, time, phone } = body;

  if (typeof bookingId !== "string" || !UUID.test(bookingId)) {
    return NextResponse.json(
      { error: "bookingId is required" },
      { status: 400 },
    );
  }

  // Only the browser that wrote this booking may open its payment.
  if (!holdsClaim(req.cookies.get(CLAIM_COOKIE)?.value, bookingId)) {
    return NextResponse.json(
      { error: "This booking was not started here", code: NOT_YOURS },
      { status: 403 },
    );
  }

  const db = getAdminClient().database;

  const { data: bookingRow } = await db
    .from("bookings")
    .select(
      "id, service_id, tier_id, status, payment_status, amount_paid_eur, stripe_session_id",
    )
    .eq("id", bookingId)
    .maybeSingle();

  const booking = bookingRow as {
    id: string;
    service_id: string | null;
    tier_id: string | null;
    status: string | null;
    payment_status: string | null;
    amount_paid_eur: number | string | null;
    stripe_session_id: string | null;
  } | null;
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  // An unpaid booking is released after thirty minutes; a client who comes
  // back to the bank after that must not pay for a slot that is gone.
  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "Booking is no longer open" },
      { status: 409 },
    );
  }
  // Paid already: a second checkout would charge the client twice. The form
  // reads the code and shows the booking as paid.
  if (holdsMoney(booking)) {
    return NextResponse.json(
      { error: "Booking is already paid", code: ALREADY_PAID },
      { status: 409 },
    );
  }
  // Waiting for its payment, and nothing else: a draft holds no hour (its
  // confirmation failed or never happened) and a booking taken at the desk is
  // `confirmed` and priced at the counter.
  if (booking.status !== "pending") {
    return NextResponse.json(
      { error: "Booking is not waiting for a payment", code: NOT_OPEN },
      { status: 409 },
    );
  }
  if (!booking.tier_id) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const { data: tierRow } = await db
    .from("service_tiers")
    .select("service_id, price_eur, price_center_eur")
    .eq("id", booking.tier_id)
    .maybeSingle();

  const tier = tierRow as {
    service_id: string | null;
    price_eur: number | null;
    price_center_eur: number | null;
  } | null;

  if (!tier) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  if (
    booking.service_id &&
    tier.service_id &&
    booking.service_id !== tier.service_id
  ) {
    return NextResponse.json(
      { error: "Tier does not belong to this booking's service" },
      { status: 400 },
    );
  }

  // Paying online means the web price, which already carries whatever
  // discount the dashboard set against the centre price.
  const listPriceEur = Number(tier.price_eur ?? tier.price_center_eur ?? 0);
  if (!Number.isFinite(listPriceEur) || listPriceEur <= 0) {
    return NextResponse.json(
      { error: "Tier has no price configured" },
      { status: 400 },
    );
  }

  const settings = await readPaymentSettings();
  const { chargeEur, finalPriceEur } = fullPaymentCharge(
    listPriceEur,
    settings,
  );

  const appUrl = getAppUrl();
  // A NEW order every time (see `checkout-order.ts`).
  const formData = provider.buildFormData({
    amount: Math.round(chargeEur * 100), // Redsys expects cents
    currency: "978", // EUR
    description: description || "Booking",
    successUrl:
      `${appUrl}/booking/confirmation?bookingId=${bookingId}` +
      `&description=${encodeURIComponent(description || "")}` +
      (date ? `&date=${encodeURIComponent(date)}` : "") +
      (time ? `&time=${encodeURIComponent(time)}` : "") +
      (phone ? `&phone=${encodeURIComponent(phone)}` : ""),
    cancelUrl: `${appUrl}/booking?payment=cancel&bookingId=${bookingId}`,
    customerEmail: email || undefined,
    customerName: name || undefined,
    metadata: { notifyUrl: `${appUrl}/api/webhooks/redsys` },
  });

  // Store the Redsys order id so the notification can be matched to the booking.
  // The column is still called `stripe_session_id` for historical reasons;
  // renaming it needs a migration, so it stays as-is for now.
  // Conditioned on the booking still holding no money: a payment notified
  // between the read above and this write keeps its order and its price.
  const { data: opened } = await db
    .from("bookings")
    .update({
      stripe_session_id: formData.orderId,
      // Always "full": a draft written by an old form may say "deposit", and
      // this is the write that decides what the booking is.
      payment_mode: "full",
      price_eur: finalPriceEur,
    })
    .eq("id", bookingId)
    .eq("status", "pending")
    .in("payment_status", ["pending", "failed"])
    .select("id");
  if (((opened ?? []) as unknown[]).length === 0) {
    return NextResponse.json(
      { error: "Booking is already paid", code: ALREADY_PAID },
      { status: 409 },
    );
  }

  // Every order opened, in the history: `stripe_session_id` keeps only the
  // last, and a payment that arrives on an earlier one (a second tab) must
  // still find its booking.
  await recordBookingEvent({
    bookingId,
    channel: "payment",
    event: "checkout",
    actorRole: "anonymous",
    summary: `Pago iniciado · ${formatPrice(chargeEur, "es")} · pedido ${formData.orderId}`,
    providerId: formData.orderId,
    payload: { orderId: formData.orderId, amountEur: chargeEur },
  });

  return NextResponse.json(formData);
}
