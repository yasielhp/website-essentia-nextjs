import { type NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { getRedsysProvider } from "@/lib/payments";
import { getAppUrl } from "@/lib/env";
import { fullPaymentCharge } from "@/lib/payments/amounts";
import { readPaymentSettings } from "@/lib/settings/app-settings";
import { PAID_STATES, orderToReuse } from "@/lib/payments/checkout-order";

type CheckoutBody = {
  bookingId: string;
  tierId: string;
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
 *
 * Only the whole price is charged (since 2026-11-24 there is no deposit). A
 * page still open on the old form may ask for `paymentMode: "deposit"`: it is
 * not refused, it is charged the whole price like everybody else, and the bank
 * page shows that amount before the client pays anything. No request can open
 * a partial charge.
 */
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

  const { bookingId, tierId, email, name, description, date, time, phone } =
    body;

  if (!bookingId || !tierId) {
    return NextResponse.json(
      { error: "bookingId and tierId are required" },
      { status: 400 },
    );
  }

  const db = getAdminClient().database;

  // The tier must actually belong to the booking's service, otherwise a caller
  // could pair an expensive booking with the cheapest tier in the catalogue.
  const { data: bookingRow } = await db
    .from("bookings")
    .select(
      "id, service_id, status, payment_status, amount_paid_eur, stripe_session_id",
    )
    .eq("id", bookingId)
    .maybeSingle();

  const booking = bookingRow as {
    id: string;
    service_id: string | null;
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
  // Paid already: a second checkout would overwrite the order the payment came
  // under and could charge the client twice.
  if (
    PAID_STATES.includes(booking.payment_status ?? "") ||
    Number(booking.amount_paid_eur ?? 0) > 0
  ) {
    return NextResponse.json(
      { error: "Booking is already paid" },
      { status: 409 },
    );
  }

  const { data: tierRow } = await db
    .from("service_tiers")
    .select("service_id, price_eur, price_center_eur")
    .eq("id", tierId)
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
  // The checkout opened a moment ago keeps its order (see `orderToReuse`).
  const reused = orderToReuse(booking, Date.now());
  const formData = provider.buildFormData({
    ...(reused ? { orderId: reused } : {}),
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
    .in("payment_status", ["pending", "failed"])
    .select("id");
  if (((opened ?? []) as unknown[]).length === 0) {
    return NextResponse.json(
      { error: "Booking is already paid" },
      { status: 409 },
    );
  }

  return NextResponse.json(formData);
}
