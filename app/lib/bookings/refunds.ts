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
  suspectedOnline,
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
  /**
   * False when the history could not be read: `entries` is then empty, and
   * nothing can be shown to have been paid online.
   */
  historyRead: boolean;
};

const SELECT =
  "id, status, payment_status, payment_mode, amount_paid_eur, stripe_session_id, balance_settled_method, first_name, last_name, email, service_title, date, time, service_tiers(label)";

/**
 * The booking and its payment history; null only when the booking itself
 * cannot be read. A history that cannot be read comes back empty with
 * `historyRead: false`: nothing is then PROVED paid online, and a booking that
 * looks paid is flagged for a check instead (`suspectedOnline`).
 */
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
  if (error) {
    console.error("[refunds] payment history unreadable:", bookingId, error);
  }
  return {
    booking: data as unknown as RefundContext["booking"],
    entries: error ? [] : ((rows ?? []) as PaymentEntry[]),
    historyRead: !error,
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
    if (!ctx) {
      console.error(
        "[refunds] booking unreadable at cancellation, refund not judged:",
        input.bookingId,
      );
      return nothing;
    }
    const online = onlinePayment(ctx.booking, ctx.entries);
    const amountEur = refundableEur(ctx.booking, ctx.entries, online);
    const by = input.source === "client_link" ? "client" : "team";
    const decision = refundOnCancel({
      onlineEur: amountEur,
      hoursBefore,
      by,
      teamRefundsLate: input.teamRefundsLate,
    });
    if (decision.reason === "nothing_online") {
      // No Redsys payment on record. A booking that still LOOKS paid online
      // (history unreadable, or the webhook's entry missing) is not dropped in
      // silence: when it would be owed, the office is asked to check.
      const suspect = suspectedOnline(ctx.booking, ctx.entries);
      if (!suspect) return nothing;
      const wouldOwe = refundOnCancel({
        onlineEur: suspect.amountEur,
        hoursBefore,
        by,
        teamRefundsLate: input.teamRefundsLate,
      }).owed;
      if (wouldOwe) {
        await flagUnverified(ctx, suspect, {
          source: input.source,
          hoursBefore,
          actorId: input.actorId ?? null,
          actorRole: input.actorRole,
        });
      } else {
        console.warn("[refunds] late cancellation of an unverified payment", {
          bookingId: input.bookingId,
          orderId: suspect.orderId,
        });
      }
      return {
        ...nothing,
        orderId: suspect.orderId,
        reason: "unverified",
      };
    }

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

/**
 * A refund that would be owed on a payment nobody can show was taken: a
 * `refund_owed` entry marked `failed` (a doubt, never counted as a debt) with
 * the reason, and the office asked to check the order before returning
 * anything.
 */
async function flagUnverified(
  ctx: RefundContext,
  suspect: { orderId: string; amountEur: number },
  how: {
    source: RefundOwedSource;
    hoursBefore: number;
    actorId: string | null;
    actorRole: BookingEventActorRole;
  },
): Promise<void> {
  const amount = formatPrice(suspect.amountEur, "es");
  const why = ctx.historyRead
    ? "sin cobro de Redsys registrado en el historial"
    : "no se pudo leer el historial de pagos";
  await recordBookingEvent({
    bookingId: ctx.booking.id,
    channel: "payment",
    event: REFUND_OWED,
    status: "failed",
    error: ctx.historyRead
      ? "unverified: no_redsys_payment"
      : "unverified: history_unreadable",
    actorId: how.actorId,
    actorRole: how.actorRole,
    summary: `Revisar reembolso · figura pagada ${amount} (pedido ${suspect.orderId}), ${why} · cancelada ${notice(how.hoursBefore)}: comprueba en Redsys si se cobró antes de devolver nada`,
    providerId: suspect.orderId,
    payload: {
      amountEur: suspect.amountEur,
      orderId: suspect.orderId,
      hoursBefore: Math.round(how.hoursBefore * 10) / 10,
      source: how.source,
      reason: "unverified",
      historyRead: ctx.historyRead,
    },
  });
  await tellTheOffice(ctx, {
    amount,
    orderId: suspect.orderId,
    source: how.source,
    late: false,
    unverified: true,
    actorRole: how.actorRole,
    actorId: how.actorId,
  });
}

/**
 * A second authorised payment for a booking that already holds money (two
 * tabs, an old page): the booking stays paid ONCE (its amount and state are
 * not touched, so the ledger counts it once), and the second charge is
 * recorded and owed back on its own order: a `payment/duplicate` entry with
 * both orders and the amount, a `refund_owed` for it (tagged `duplicate`, kept
 * apart from the booking's own refund), and the office's "refund owed" email
 * naming the duplicate order. Never throws.
 */
export async function recordDuplicatePayment(input: {
  bookingId: string;
  orderId: string;
  amountEur: number;
  firstOrderId: string | null;
}): Promise<void> {
  const { bookingId, orderId, amountEur, firstOrderId } = input;
  const amount = formatPrice(amountEur, "es");
  try {
    await recordBookingEvent({
      bookingId,
      channel: "payment",
      event: "duplicate",
      actorRole: "system",
      summary:
        `Pago duplicado · ${amount} · pedido ${orderId} · la reserva ya estaba pagada` +
        (firstOrderId ? ` con el pedido ${firstOrderId}` : ""),
      providerId: orderId,
      payload: { orderId, firstOrderId, amountEur, duplicate: true },
    });
    await recordBookingEvent({
      bookingId,
      channel: "payment",
      event: REFUND_OWED,
      actorRole: "system",
      summary: `Reembolso pendiente · ${amount} · pedido ${orderId} · pago duplicado`,
      providerId: orderId,
      payload: {
        amountEur,
        orderId,
        firstOrderId,
        reason: "duplicate",
        duplicate: true,
      },
    });
    const ctx = await readRefundContext(bookingId);
    if (!ctx) {
      console.error("[refunds] duplicate payment, booking unreadable:", {
        bookingId,
        orderId,
      });
      return;
    }
    await tellTheOffice(ctx, {
      amount,
      orderId,
      source: "duplicate",
      late: false,
      duplicateOf: firstOrderId,
      actorRole: "system",
      actorId: null,
    });
  } catch (err) {
    console.error("[refunds] could not record the duplicate payment:", err);
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
    /** Paid online by the booking's word only: the office is asked to check. */
    unverified?: boolean;
    /** A duplicate payment: the order the booking was first paid with. */
    duplicateOf?: string | null;
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
  const subject = `${notice.unverified ? "Revisar reembolso" : notice.source === "duplicate" ? "Reembolso pendiente (pago duplicado)" : "Reembolso pendiente"} — ${notice.amount} · ${clientName}`;
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
        unverified: notice.unverified === true,
        duplicateOf: notice.duplicateOf ?? null,
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
