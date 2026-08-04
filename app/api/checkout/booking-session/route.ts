import { type NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { getRedsysProvider } from "@/lib/payments";
import { getAppUrl } from "@/lib/env";

type CheckoutBody = {
  bookingId: string;
  tierId: string;
  email?: string;
  name?: string;
  description?: string;
  date?: string;
  time?: string;
  phone?: string;
};

/**
 * Creates a Redsys checkout for a booking.
 *
 * The amount is resolved from `service_tiers` on the server and never from the
 * request body. Trusting a client-supplied `amountEur` allowed paying an
 * arbitrary amount — one cent — for any service.
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
    .select("id, service_id")
    .eq("id", bookingId)
    .maybeSingle();

  const booking = bookingRow as {
    id: string;
    service_id: string | null;
  } | null;
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
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

  const priceEur = Number(tier.price_eur ?? tier.price_center_eur ?? 0);
  if (!Number.isFinite(priceEur) || priceEur <= 0) {
    return NextResponse.json(
      { error: "Tier has no price configured" },
      { status: 400 },
    );
  }

  const appUrl = getAppUrl();
  const formData = provider.buildFormData({
    amount: Math.round(priceEur * 100), // Redsys expects cents
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
  await db
    .from("bookings")
    .update({ stripe_session_id: formData.orderId })
    .eq("id", bookingId);

  return NextResponse.json(formData);
}
