import { type NextRequest, NextResponse } from "next/server";
import { RedsysProvider } from "@/lib/payments/redsys";
import { handleBookingPaid } from "@/actions/payments";
import { insforge } from "@/lib/insforge";

function buildProvider(): RedsysProvider | null {
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
  const provider = buildProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "Redsys not configured" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);
  const signature = params.get("Ds_Signature") ?? "";

  try {
    const event = provider.parseWebhookEvent(rawBody, signature);
    const payload = event.payload as Record<string, string>;

    const orderId = payload.Ds_Order ?? "";
    if (orderId) {
      const { data: booking } = await insforge.database
        .from("bookings")
        .select("id")
        .eq("stripe_session_id", orderId)
        .maybeSingle();

      const bookingId = (booking as { id: string } | null)?.id;
      if (bookingId) {
        if (event.type === "payment.succeeded") {
          await handleBookingPaid(bookingId);
        } else {
          await insforge.database
            .from("bookings")
            .update({ payment_status: "failed" })
            .eq("id", bookingId);
        }
      }
    }
  } catch {
    // Return 200 — Redsys retries on non-200 responses
    return new NextResponse("KO", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Redsys expects "OK" text to confirm receipt
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
