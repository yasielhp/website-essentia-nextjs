import { type NextRequest, NextResponse } from "next/server";
import { getRedsysProvider } from "@/lib/payments";
import { getAdminClient } from "@/lib/insforge-admin";
import { handleBookingPaid } from "@/services/booking-payments.service";
import { recordBookingEvent } from "@/lib/booking-events/record";

/** Redsys retries on any non-200 response, so both outcomes reply with 200. */
function redsysReply(body: "OK" | "KO") {
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  const provider = getRedsysProvider();
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
    if (!orderId) return redsysReply("OK");

    const db = getAdminClient().database;
    const { data: booking } = await db
      .from("bookings")
      .select("id")
      .eq("stripe_session_id", orderId)
      .maybeSingle();

    const bookingId = (booking as { id: string } | null)?.id;
    if (!bookingId) {
      // Unknown order: acknowledge so Redsys stops retrying, but leave a trace.
      console.error("[webhooks/redsys] no booking for order", orderId);
      return redsysReply("OK");
    }

    if (event.type === "payment.succeeded") {
      await handleBookingPaid(bookingId);
    } else {
      await db
        .from("bookings")
        .update({ payment_status: "failed" })
        .eq("id", bookingId);

      // A refusal used to be visible only as a booking that stayed unpaid, so
      // the response code travels into the entry: it is the only thing that
      // says whether the card was declined or the client simply gave up.
      const responseCode = payload.Ds_Response ?? "";
      await recordBookingEvent({
        bookingId,
        channel: "payment",
        event: "failed",
        status: "failed",
        actorRole: "system",
        summary: "Pago rechazado por Redsys",
        providerId: orderId,
        error: responseCode ? `Ds_Response ${responseCode}` : null,
        payload: {
          orderId,
          response: responseCode || null,
          amountCents: payload.Ds_Amount ?? null,
          currency: payload.Ds_Currency ?? null,
        },
      });
    }
  } catch (err) {
    // A malformed or unsigned notification must never look like a success, and
    // swallowing it silently used to hide genuine payment failures.
    console.error("[webhooks/redsys] rejected notification:", err);
    return redsysReply("KO");
  }

  return redsysReply("OK");
}
