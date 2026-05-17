import { type NextRequest, NextResponse } from "next/server";
import { createProviderFromEnv } from "@/lib/payments";

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

    switch (event.type) {
      case "checkout.session.completed":
        // TODO: mark booking as paid using event.payload.metadata.bookingId
        break;
      case "payment_intent.payment_failed":
        // TODO: mark booking as failed
        break;
      case "charge.refunded":
        // TODO: mark booking as refunded
        break;
    }
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
