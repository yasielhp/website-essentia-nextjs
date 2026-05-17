import { type NextRequest, NextResponse } from "next/server";
import { createProviderFromEnv } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const provider = createProviderFromEnv();
  if (!provider || provider.name !== "redsys") {
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

    switch (event.type) {
      case "payment.succeeded":
        // TODO: mark booking as paid using event.payload.DS_MERCHANT_ORDER
        break;
      case "payment.failed":
        // TODO: mark booking as failed
        break;
    }
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
