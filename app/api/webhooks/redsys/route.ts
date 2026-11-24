import { type NextRequest, NextResponse } from "next/server";
import { getRedsysProvider } from "@/lib/payments";
import { getAdminClient } from "@/lib/insforge-admin";
import { handleBookingPaid } from "@/services/booking-payments.service";
import { handleBonusPaid } from "@/services/bonus-payments.service";
import { recordBookingEvent } from "@/lib/booking-events/record";

/** The payment states a refused payment may move to `failed`. */
const UNPAID = ["pending", "failed"];

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

    // A refund made in the Redsys portal, a cancellation: an operation on the
    // same order that is not the client paying. It changes nothing here (a
    // refund is recorded by hand in the dashboard), and it is acknowledged so
    // Redsys does not retry it.
    if (event.type === "ignored") {
      console.warn(
        "[webhooks/redsys] ignored a notification that is not a payment",
        {
          orderId,
          transactionType: payload.Ds_TransactionType ?? null,
          response: payload.Ds_Response ?? null,
          amountCents: payload.Ds_Amount ?? null,
        },
      );
      return redsysReply("OK");
    }

    const db = getAdminClient().database;
    const { data: booking } = await db
      .from("bookings")
      .select("id, payment_status")
      .eq("stripe_session_id", orderId)
      .maybeSingle();

    const bookingId = (booking as { id: string } | null)?.id;
    const paymentStatus =
      (booking as { payment_status: string | null } | null)?.payment_status ??
      null;
    if (!bookingId) {
      // Not a booking: it may be a bonus bought on the website. Their order
      // numbers carry a letter, so the two can never be the same order.
      const { data: bonusOrder } = await db
        .from("bonus_orders")
        .select("id")
        .eq("redsys_order", orderId)
        .maybeSingle();

      if (bonusOrder) {
        if (event.type === "payment.succeeded") {
          await handleBonusPaid(orderId, Number(payload.Ds_Amount));
        } else {
          // Only a pending order can fail; a paid one stays paid.
          await db
            .from("bonus_orders")
            .update({ status: "failed" })
            .eq("redsys_order", orderId)
            .eq("status", "pending");
        }
        return redsysReply("OK");
      }

      // Unknown order: acknowledge so Redsys stops retrying, but leave a trace.
      console.error("[webhooks/redsys] no booking or bonus for order", orderId);
      return redsysReply("OK");
    }

    if (event.type === "payment.succeeded") {
      await handleBookingPaid(bookingId, Number(payload.Ds_Amount));
    } else if (!UNPAID.includes(paymentStatus ?? "pending")) {
      // A refusal can never take money back: a booking that is paid, part
      // paid or refunded keeps its state, and no "rejected" line is written
      // over a payment that went through.
      console.warn("[webhooks/redsys] refusal on a booking with money kept", {
        orderId,
        paymentStatus,
        response: payload.Ds_Response ?? null,
      });
    } else {
      // Conditioned on the state read above, for the same reason.
      await db
        .from("bookings")
        .update({ payment_status: "failed" })
        .eq("id", bookingId)
        .in("payment_status", UNPAID);

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
