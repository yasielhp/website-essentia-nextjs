import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { insforge } from "@/lib/insforge";

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 },
    );
  }

  const body = (await req.json()) as {
    bookingId: string;
    tierId: string;
    email: string;
    name: string;
    description: string;
  };

  const { bookingId, tierId, email, name, description } = body;
  if (!bookingId || !tierId) {
    return NextResponse.json(
      { error: "bookingId and tierId are required" },
      { status: 400 },
    );
  }

  // Fetch the Stripe price ID for this tier
  const { data: tier } = await insforge.database
    .from("service_tiers")
    .select("stripe_price_id, price_eur")
    .eq("id", tierId)
    .single();

  const stripe = new Stripe(key);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const returnUrl = `${appUrl}/booking?payment=success&bookingId=${bookingId}&session_id={CHECKOUT_SESSION_ID}`;

  const tierData = tier as {
    stripe_price_id: string | null;
    price_eur: number | null;
  } | null;
  const priceEur = Number(tierData?.price_eur ?? 0);

  type LineItem = NonNullable<
    Stripe.Checkout.SessionCreateParams["line_items"]
  >[number];
  const lineItem: LineItem = tierData?.stripe_price_id
    ? { price: tierData.stripe_price_id, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(priceEur * 100),
          product_data: { name: description },
        },
      };

  const session = await stripe.checkout.sessions.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ui_mode: "embedded" as any,
    mode: "payment",
    line_items: [lineItem],
    return_url: returnUrl,
    customer_email: email || undefined,
    metadata: { bookingId, customerName: name },
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}
