import { type NextRequest, NextResponse } from "next/server";
import { createProviderFromEnv } from "@/lib/payments";
import { handleBookingPaid } from "@/actions/payments";
import { insforge } from "@/lib/insforge";

export async function POST(req: NextRequest) {
  const provider = createProviderFromEnv();
  if (!provider || provider.name !== "stripe") {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  try {
    const event = provider.parseWebhookEvent(rawBody, signature);
    const payload = event.payload as Record<string, unknown>;

    switch (event.type) {
      case "checkout.session.completed": {
        const meta = (payload.metadata ?? {}) as Record<string, string>;
        const bookingId = meta.bookingId;
        if (bookingId) {
          await insforge.database
            .from("bookings")
            .update({ stripe_session_id: payload.id as string })
            .eq("id", bookingId);
          await handleBookingPaid(bookingId);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const meta = (payload.metadata ?? {}) as Record<string, string>;
        const bookingId = meta.bookingId;
        if (bookingId) {
          await insforge.database
            .from("bookings")
            .update({ payment_status: "failed" })
            .eq("id", bookingId);
        }
        break;
      }
      case "charge.refunded": {
        const meta = (payload.metadata ?? {}) as Record<string, string>;
        const bookingId = meta.bookingId;
        if (bookingId) {
          await insforge.database
            .from("bookings")
            .update({ payment_status: "refunded" })
            .eq("id", bookingId);
        }
        break;
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
