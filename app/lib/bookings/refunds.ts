import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { officeAddress, sendEmail } from "@/emails/send";
import {
  staffRefundOwedEmail,
  type RefundOwedSource,
} from "@/emails/templates/staff-refund-owed";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type {
  BookingEventActorRole,
  BookingEventInput,
} from "@/lib/booking-events/types";
import { formatLongDate } from "@/lib/format-date";
import { formatPrice } from "@/utils/format";
import { hoursUntilSession } from "@/lib/bookings/cancellation-window";
import {
  REFUND_OWED,
  REFUND_WAIVED,
  onlinePayment,
  refundOnCancel,
  refundState,
  refundableEur,
  type PaymentEntry,
  type RefundBooking,
  type RefundReason,
} from "@/lib/bookings/refund-rules";

/**
 * The refund side of a cancellation. SERVER ONLY and not a Server Action: it
 * carries no role check, and its callers (the cancellation link, the
 * dashboard's save, the assistants' tool) have each decided who is asking.
 *
 * Nothing here returns money. A booking paid online and cancelled at least 24
 * hours before gets a `refund_owed` entry in its history, which the booking's
 * page shows as "Reembolso pendiente", and the office an email with the
 * amount and the Redsys order number; the money is returned by hand in the
 * Redsys portal and then marked as refunded on the booking
 * (`markBookingRefunded`).
 */

export type RefundContext = {
  booking: RefundBooking & {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    service_title: string | null;
    date: string | null;
    time: string | null;
    service_tiers: { label: string | null } | null;
  };
  /** The booking's `payment` entries, oldest first. */
  entries: PaymentEntry[];
};

const SELECT =
  "id, status, payment_status, payment_mode, amount_paid_eur, stripe_session_id, balance_settled_method, first_name, last_name, email, service_title, date, time, service_tiers(label)";

/** The booking and its payment history, or null when it cannot be read. */
export async function readRefundContext(
  bookingId: string,
): Promise<RefundContext | null> {
  const db = getAdminClient().database;
  const { data } = await db
    .from("bookings")
    .select(SELECT)
    .eq("id", bookingId)
    .maybeSingle();
  if (!data) return null;
  const { data: rows, error } = await db
    .from("booking_events")
    .select("event, actor_role, provider_id, payload, created_at, status")
    .eq("booking_id", bookingId)
    .eq("channel", "payment")
    .order("created_at", { ascending: true });
  // Without the history the online money cannot be told from the desk's: say
  // nothing rather than something wrong.
  if (error) return null;
  return {
    booking: data as unknown as RefundContext["booking"],
    entries: (rows ?? []) as PaymentEntry[],
  };
}

/** What the client can be told before cancelling: the refund, or null. */
export async function refundIfCancelledNow(
  bookingId: string,
): Promise<number | null> {
  try {
    const ctx = await readRefundContext(bookingId);
    if (!ctx) return null;
    const amount = refundableEur(
      ctx.booking,
      ctx.entries,
      onlinePayment(ctx.booking, ctx.entries),
    );
    return amount > 0 ? amount : null;
  } catch (err) {
    console.error("[refunds] could not read the payment:", err);
    return null;
  }
}

export type CancelRefund = {
  owed: boolean;
  amountEur: number;
  orderId: string | null;
  reason: RefundReason;
  /** Hours from the cancellation to the session, as the decision read them. */
  hoursBefore: number;
};

/** `con 30 h de antelación`, or after the hour when it had begun. */
function notice(hours: number): string {
  return hours < 0
    ? "después de la hora de la sesión"
    : `con ${Math.floor(hours)} h de antelación`;
}

/**
 * After a booking has been cancelled: records whether money is owed back and,
 * when it is, tells the office. Called by every path that cancels, AFTER the
 * status is written. `date` and `time` are the session as it stood when it was
 * cancelled. Never throws: the cancellation already happened.
 */
export async function settleRefundOnCancel(input: {
  bookingId: string;
  source: RefundOwedSource;
  actorId?: string | null;
  actorRole: BookingEventActorRole;
  date: string | null;
  time: string | null;
  /** The team's choice for a cancellation inside the last 24 hours. */
  teamRefundsLate?: boolean;
  now?: number;
}): Promise<CancelRefund> {
  const hoursBefore = hoursUntilSession(input.date, input.time, input.now);
  const nothing: CancelRefund = {
    owed: false,
    amountEur: 0,
    orderId: null,
    reason: "nothing_online",
    hoursBefore,
  };

  try {
    const ctx = await readRefundContext(input.bookingId);
    if (!ctx) return nothing;
    const online = onlinePayment(ctx.booking, ctx.entries);
    const amountEur = refundableEur(ctx.booking, ctx.entries, online);
    const by = input.source === "client_link" ? "client" : "team";
    const decision = refundOnCancel({
      onlineEur: amountEur,
      hoursBefore,
      by,
      teamRefundsLate: input.teamRefundsLate,
    });
    if (decision.reason === "nothing_online") return nothing;

    const actor = {
      bookingId: input.bookingId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole,
    };
    const amount = formatPrice(amountEur, "es");
    const payload = {
      amountEur,
      orderId: online.orderId,
      hoursBefore: Math.round(hoursBefore * 10) / 10,
      source: input.source,
      reason: decision.reason,
    };

    if (!decision.owed) {
      await recordBookingEvent({
        ...actor,
        channel: "payment",
        event: REFUND_WAIVED,
        summary:
          `Sin reembolso · cancelada ${notice(hoursBefore)} (menos de 24 h)` +
          (by === "team" ? " · decisión del equipo" : ""),
        providerId: online.orderId,
        payload,
      });
      return {
        owed: false,
        amountEur: 0,
        orderId: online.orderId,
        reason: decision.reason,
        hoursBefore,
      };
    }

    const late = decision.reason === "late_team_refunds";
    await recordBookingEvent({
      ...actor,
      channel: "payment",
      event: REFUND_OWED,
      summary:
        `Reembolso pendiente · ${amount}` +
        (online.orderId ? ` · pedido ${online.orderId}` : "") +
        ` · cancelada ${notice(hoursBefore)}` +
        (late ? " · el equipo decide devolverlo" : ""),
      providerId: online.orderId,
      payload,
    });

    await tellTheOffice(ctx, {
      amount,
      orderId: online.orderId,
      source: input.source,
      late,
      actorRole: input.actorRole,
      actorId: input.actorId ?? null,
    });

    return {
      owed: true,
      amountEur,
      orderId: online.orderId,
      reason: decision.reason,
      hoursBefore,
    };
  } catch (err) {
    console.error("[refunds] could not settle the cancellation:", err);
    return nothing;
  }
}

/** The email to the office, recorded in the history like every other. */
async function tellTheOffice(
  ctx: RefundContext,
  notice: {
    amount: string;
    orderId: string | null;
    source: RefundOwedSource;
    late: boolean;
    actorRole: BookingEventActorRole;
    actorId: string | null;
  },
): Promise<void> {
  const b = ctx.booking;
  const clientName =
    [b.first_name, b.last_name].filter(Boolean).join(" ").trim() ||
    (b.email ?? "—");
  const service = [b.service_title, b.service_tiers?.label]
    .filter(Boolean)
    .join(" — ");
  const subject = `Reembolso pendiente — ${notice.amount} · ${clientName}`;
  const entry: BookingEventInput = {
    bookingId: b.id,
    channel: "email",
    event: REFUND_OWED,
    summary: subject,
    actorId: notice.actorId,
    actorRole: notice.actorRole,
  };

  let to: string | null = null;
  try {
    to = await officeAddress();
    const { error, id } = await sendEmail({
      to,
      subject,
      html: staffRefundOwedEmail({
        locale: "es",
        clientName,
        clientEmail: b.email,
        service: service || "—",
        session: [formatLongDate(b.date, "es"), b.time]
          .filter(Boolean)
          .join(", "),
        amount: notice.amount,
        orderId: notice.orderId,
        source: notice.source,
        late: notice.late,
        bookingUrl: `${getAppUrl()}/dashboard/bookings/${b.id}`,
      }),
    });
    await recordBookingEvent(
      error
        ? { ...entry, recipient: to, status: "failed", error: error.message }
        : { ...entry, recipient: to, status: "sent", providerId: id ?? null },
    );
  } catch (err) {
    await recordBookingEvent({
      ...entry,
      recipient: to,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * A cancelled booking brought back (its status changed from `cancelled`):
 * a refund still pending is no longer owed, and the history says so with a
 * `refund_waived`, so a later cancellation decides the money afresh. Never
 * throws.
 */
export async function withdrawRefundOnReactivation(input: {
  bookingId: string;
  actorId?: string | null;
  actorRole: BookingEventActorRole;
}): Promise<void> {
  try {
    const ctx = await readRefundContext(input.bookingId);
    if (!ctx) return;
    const online = onlinePayment(ctx.booking, ctx.entries);
    // Read as if still cancelled: the status has just been written.
    const pending = refundState(
      { ...ctx.booking, status: "cancelled" },
      ctx.entries,
      online,
    );
    if (pending.kind !== "owed") return;
    await recordBookingEvent({
      bookingId: input.bookingId,
      channel: "payment",
      event: REFUND_WAIVED,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole,
      summary: `Sin reembolso · la reserva se ha reactivado (estaban pendientes ${formatPrice(pending.amountEur, "es")})`,
      providerId: online.orderId,
      payload: {
        amountEur: pending.amountEur,
        orderId: online.orderId,
        reason: "reactivated",
      },
    });
  } catch (err) {
    console.error("[refunds] could not withdraw the pending refund:", err);
  }
}
