import { type NextRequest, NextResponse } from "next/server";
import { insforge } from "@/lib/insforge";
import { RedsysProvider } from "@/lib/payments/redsys";

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function buildRedsysProvider(): RedsysProvider | null {
  const merchantCode = process.env.REDSYS_MERCHANT_CODE;
  const terminal = process.env.REDSYS_TERMINAL ?? "001";
  const secretKey = process.env.REDSYS_SECRET_KEY;
  if (!merchantCode || !secretKey) return null;
  return new RedsysProvider({
    merchantCode,
    terminal,
    secretKey,
    environment: (process.env.REDSYS_ENVIRONMENT as "test" | "live") ?? "test",
  });
}

export async function POST(req: NextRequest) {
  const provider = buildRedsysProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "Redsys not configured" },
      { status: 500 },
    );
  }

  let body: {
    bookingId: string;
    tierId: string;
    amountEur?: number | null;
    email: string;
    name: string;
    description: string;
    date?: string;
    time?: string;
    phone?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    bookingId,
    tierId,
    amountEur: bodyAmountEur,
    email,
    name,
    description,
    date,
    time,
    phone,
  } = body;
  if (!bookingId || !tierId) {
    return NextResponse.json(
      { error: "bookingId and tierId are required" },
      { status: 400 },
    );
  }

  // Use client-provided price if available; fall back to DB lookup
  let priceEur = bodyAmountEur != null ? Number(bodyAmountEur) : 0;
  if (priceEur <= 0) {
    const { data: tier } = await insforge.database
      .from("service_tiers")
      .select("price_eur, price_center_eur")
      .eq("id", tierId)
      .single();
    const t = tier as {
      price_eur: number | null;
      price_center_eur: number | null;
    } | null;
    priceEur = Number(t?.price_eur ?? t?.price_center_eur ?? 0);
  }
  if (priceEur <= 0) {
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

  // Store Redsys order ID so we can match the notification back to the booking
  await insforge.database
    .from("bookings")
    .update({ stripe_session_id: formData.orderId })
    .eq("id", bookingId);

  return NextResponse.json(formData);
}
