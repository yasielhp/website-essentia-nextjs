import { CANCELLATION_WINDOW_HOURS } from "@/constants/booking";

/**
 * What a cancelled booking owes back, read from the booking and its payment
 * history. Pure, so the cancellation paths, the dashboard and the tests agree.
 *
 * Nothing here returns money: Redsys refunds are made by hand in its portal.
 * What the code keeps is the record: a `refund_owed` entry when a booking
 * paid online is cancelled at least 24 hours before (or inside them, when
 * the team decides to refund anyway), a `refund_waived` entry when it is
 * cancelled later and nothing is owed, and a `refunded` entry when an
 * administrator marks the money as returned. No column holds the state: it is
 * those entries plus `payment_status`, so no migration is needed.
 *
 * Bookings drawn from a bonus (`payment_mode = 'bonus'`) are out of it: the
 * money was paid for the bonus, not for the session.
 */

/** The history's words for the three steps (`booking_events.event`). */
export const REFUND_OWED = "refund_owed";
export const REFUND_WAIVED = "refund_waived";
export const REFUNDED = "refunded";

/** The columns of a booking the rules read. */
export type RefundBooking = {
  status: string | null;
  payment_status: string | null;
  payment_mode: string | null;
  amount_paid_eur: number | string | null;
  /** The Redsys order number, under its historical name. */
  stripe_session_id: string | null;
  balance_settled_method: string | null;
};

/** One `channel = 'payment'` entry of the booking's history, oldest first. */
export type PaymentEntry = {
  event: string;
  actor_role: string | null;
  provider_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  /** `failed` marks an entry that records a doubt, not a fact: never counted. */
  status?: string | null;
};

/** An entry that states a fact (not a `failed` one, which records a doubt). */
const counts = (e: PaymentEntry) => e.status !== "failed";

/** What was paid online, and the Redsys order that took it. */
export type OnlinePayment = { orderId: string | null; onlineEur: number };

export type RefundState =
  | { kind: "none" }
  | { kind: "owed"; amountEur: number }
  | { kind: "refunded"; amountEur: number };

/** What the dashboard shows of a booking's online payment and its refund. */
export type BookingRefundView = OnlinePayment & {
  state: RefundState;
  /**
   * What the booking says was paid under its order when no Redsys payment is
   * recorded: to be checked in the portal before returning anything (0 when
   * the payment is on record, or there is none).
   */
  unverifiedEur: number;
  /** What can still be marked as refunded (0 when nothing can). */
  refundableEur: number;
  /** True for an administrator, on a cancelled booking with money to return. */
  canMark: boolean;
};

/** Why marking a refund was refused (`markBookingRefunded`). */
export type MarkRefundError =
  | "unauthorized"
  | "invalid"
  | "not_found"
  | "not_cancelled"
  | "nothing_to_refund"
  | "exceeds"
  | "conflict"
  | "failed";

export type RefundReason =
  /** Nothing was paid online: there is nothing to return. */
  | "nothing_online"
  /** It looks paid online but no Redsys payment is on record: to check. */
  | "unverified"
  /** Cancelled at least 24 hours before: the Terms promise the refund. */
  | "in_advance"
  /** Inside the last 24 hours (or after the session): no refund. */
  | "late"
  /** Inside the last 24 hours, and the team chose to refund all the same. */
  | "late_team_refunds";

export type RefundDecision = { owed: boolean; reason: RefundReason };

const toCents = (eur: number) => Math.round(eur * 100);

/** The amount an entry carries, or 0. */
export function entryAmount(entry: Pick<PaymentEntry, "payload">): number {
  const value = Number(entry.payload?.amountEur);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Money that came through Redsys: ONLY the payments the webhook recorded
 * after a signed, authorised notification (actor `system`, with the order
 * number). A payment taken at the desk has neither, and an order number on the
 * booking proves nothing: it is written when the checkout STARTS, so a client
 * who gave up at the bank and paid at the desk has one too. Without that
 * evidence nothing is owed and nobody is told to refund (`suspectedOnline`
 * only asks somebody to check).
 */
export function onlinePayment(
  booking: RefundBooking,
  entries: PaymentEntry[],
): OnlinePayment {
  if (booking.payment_mode === "bonus") return { orderId: null, onlineEur: 0 };

  const redsys = entries.filter(
    (e) => e.event === "paid" && e.actor_role === "system" && e.provider_id,
  );
  if (redsys.length > 0) {
    const cents = redsys.reduce((sum, e) => sum + toCents(entryAmount(e)), 0);
    return {
      orderId: redsys.at(-1)?.provider_id ?? null,
      onlineEur: cents / 100,
    };
  }

  return { orderId: null, onlineEur: 0 };
}

/**
 * A booking that LOOKS paid online but has no Redsys payment in its history
 * (the entry was never written, or the history could not be read): paid,
 * under an order number, nothing taken at the desk. Not a debt, a doubt: the
 * office is asked to check the order in the Redsys portal. The amount is what
 * the booking held before any refund marked on it.
 */
export function suspectedOnline(
  booking: RefundBooking,
  entries: PaymentEntry[],
): { orderId: string; amountEur: number } | null {
  if (booking.payment_mode === "bonus" || !booking.stripe_session_id) {
    return null;
  }
  if (onlinePayment(booking, entries).onlineEur > 0) return null;
  if (!["paid", "deposit_paid"].includes(booking.payment_status ?? "")) {
    return null;
  }
  if (booking.balance_settled_method) return null;
  const held =
    toCents(Number(booking.amount_paid_eur ?? 0)) + refundedCents(entries);
  return held > 0
    ? { orderId: booking.stripe_session_id, amountEur: held / 100 }
    : null;
}

/**
 * Whether cancelling now leaves money to return.
 *
 * At least 24 hours before, always: whoever cancels, the Terms promise it. A
 * client cannot cancel later than that on their own (the link refuses), so a
 * late cancellation is the team's, and the team decides, "no refund" unless
 * they say otherwise: the late ones are mostly a client calling at the last
 * minute or not turning up, which the Terms do not refund; when it is the
 * centre that cancels (somebody ill, a room lost), the team ticks it.
 */
export function refundOnCancel(input: {
  onlineEur: number;
  hoursBefore: number;
  by: "client" | "team";
  teamRefundsLate?: boolean;
}): RefundDecision {
  if (!(input.onlineEur > 0)) return { owed: false, reason: "nothing_online" };
  if (input.hoursBefore >= CANCELLATION_WINDOW_HOURS) {
    return { owed: true, reason: "in_advance" };
  }
  if (input.by === "team" && input.teamRefundsLate === true) {
    return { owed: true, reason: "late_team_refunds" };
  }
  return { owed: false, reason: "late" };
}

/**
 * What the edit screen recorded as the team's choice: true when the refund is
 * owed. At least 24 hours before (as the screen measured it, when "Cancelada"
 * was chosen) it is owed and the screen said so; inside them, the box. Sent to
 * the server as `refundLate`, so a save a few seconds past the 24 hours still
 * records what the person was shown.
 */
export function teamChoiceOnSave(input: {
  refundableEur: number;
  shownInAdvance: boolean;
  ticked: boolean;
}): boolean {
  if (!(input.refundableEur > 0)) return false;
  return input.shownInAdvance || input.ticked;
}

/**
 * Whether a dashboard save that cancels would also take away the money a
 * refund is owed on: the payment set back to unpaid, or its amount lowered.
 * Such a save is refused: the money paid online is returned and recorded with
 * "Marcar como reembolsado", never by editing the payment.
 */
export function cancelErasesOnlinePayment(
  booking: RefundBooking,
  entries: PaymentEntry[],
  payload: { payment_status?: string | null; amount_paid_eur?: number | null },
): boolean {
  if (refundableEur(booking, entries, onlinePayment(booking, entries)) <= 0) {
    return false;
  }
  const lowersStatus =
    payload.payment_status !== undefined &&
    !["paid", "deposit_paid"].includes(payload.payment_status ?? "");
  const lowersAmount =
    payload.amount_paid_eur !== undefined &&
    toCents(Number(payload.amount_paid_eur ?? 0)) <
      toCents(Number(booking.amount_paid_eur ?? 0));
  return lowersStatus || lowersAmount;
}

/** Cents already marked as returned. */
function refundedCents(entries: PaymentEntry[]): number {
  return entries
    .filter((e) => e.event === REFUNDED && counts(e))
    .reduce((sum, e) => sum + toCents(entryAmount(e)), 0);
}

/**
 * What can still be marked as returned: the online money, less what was
 * already returned, and never more than the booking still holds.
 */
export function refundableEur(
  booking: RefundBooking,
  entries: PaymentEntry[],
  online: OnlinePayment,
): number {
  if (booking.payment_mode === "bonus") return 0;
  if (!["paid", "deposit_paid"].includes(booking.payment_status ?? "")) {
    return 0;
  }
  const left = Math.min(
    toCents(online.onlineEur) - refundedCents(entries),
    toCents(Number(booking.amount_paid_eur ?? 0)),
  );
  return left > 0 ? left / 100 : 0;
}

/**
 * Where the refund stands, decided by the LATEST word on it: a `refund_owed`
 * stands until a later `refund_waived` (a late cancellation after a
 * reactivation, or the reactivation itself) or the `refunded` entries after it
 * settle it, and only while the booking is cancelled. Owed is what that last
 * `refund_owed` named, less what was returned since; returned, or nothing.
 */
export function refundState(
  booking: RefundBooking,
  entries: PaymentEntry[],
  online: OnlinePayment,
): RefundState {
  const returned = refundedCents(entries);
  if (booking.payment_status === "refunded") {
    return {
      kind: "refunded",
      amountEur: returned > 0 ? returned / 100 : online.onlineEur,
    };
  }

  let last = -1;
  entries.forEach((e, i) => {
    if ((e.event === REFUND_OWED || e.event === REFUND_WAIVED) && counts(e)) {
      last = i;
    }
  });
  const lastWord = last >= 0 ? entries[last] : undefined;
  if (booking.status === "cancelled" && lastWord?.event === REFUND_OWED) {
    const owed = toCents(entryAmount(lastWord));
    const returnedSince = refundedCents(entries.slice(last + 1));
    const left = Math.min(
      owed - returnedSince,
      toCents(refundableEur(booking, entries, online)),
    );
    if (left > 0) return { kind: "owed", amountEur: left / 100 };
  }

  return returned > 0
    ? { kind: "refunded", amountEur: returned / 100 }
    : { kind: "none" };
}

/** Everything already marked as returned on the booking, in euros. */
export function refundedEur(entries: PaymentEntry[]): number {
  return refundedCents(entries) / 100;
}

/**
 * The write that records `amountEur` as returned. Part of it: the booking
 * keeps the rest as income (its `amount_paid_eur` goes down to what it still
 * holds) and its state stays. The rest of it: the booking becomes `refunded`,
 * which the ledger stops counting as income, and `amount_paid_eur` becomes the
 * TOTAL returned (`alreadyRefundedEur`, the earlier partial refunds, plus this
 * one), so the ledger's "refunded" row says 100 € after 40 € and 60 €, not the
 * last 60 €.
 */
export function refundPatch(
  booking: Pick<RefundBooking, "amount_paid_eur">,
  amountEur: number,
  alreadyRefundedEur = 0,
):
  | { payment_status: "refunded"; amount_paid_eur: number }
  | { amount_paid_eur: number } {
  const paid = toCents(Number(booking.amount_paid_eur ?? 0));
  const back = toCents(amountEur);
  return back >= paid
    ? {
        payment_status: "refunded",
        amount_paid_eur: (toCents(alreadyRefundedEur) + back) / 100,
      }
    : { amount_paid_eur: (paid - back) / 100 };
}

/**
 * What an administrator may mark as returned: the online money on record, or,
 * when there is none, what a booking that looks paid online held (they mark it
 * after checking the order in the portal, which is the evidence then).
 */
export function markableEur(
  booking: RefundBooking,
  entries: PaymentEntry[],
): number {
  const online = onlinePayment(booking, entries);
  if (online.onlineEur > 0) return refundableEur(booking, entries, online);
  const suspect = suspectedOnline(booking, entries);
  return suspect
    ? refundableEur(booking, entries, {
        orderId: suspect.orderId,
        onlineEur: suspect.amountEur,
      })
    : 0;
}

/** The dashboard's view of it, from what the server read. */
export function refundView(
  booking: RefundBooking,
  entries: PaymentEntry[],
  isAdmin: boolean,
): BookingRefundView {
  const online = onlinePayment(booking, entries);
  const suspect = suspectedOnline(booking, entries);
  const markable = markableEur(booking, entries);
  return {
    orderId: online.orderId ?? suspect?.orderId ?? null,
    onlineEur: online.onlineEur,
    unverifiedEur: suspect?.amountEur ?? 0,
    state: refundState(booking, entries, online),
    refundableEur: markable,
    canMark: isAdmin && booking.status === "cancelled" && markable > 0,
  };
}
