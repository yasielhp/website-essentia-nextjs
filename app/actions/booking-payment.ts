"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type { BookingEventActorRole } from "@/lib/booking-events/types";
import { amountOwed, paymentStatusAfter } from "@/lib/payments/amounts";
import { formatPrice } from "@/utils/format";
import type { BalanceMethod } from "@/types/booking";

const METHODS: BalanceMethod[] = ["cash", "card", "transfer", "other"];

/**
 * Money taken at the counter: the balance of a deposit, a cash deposit on a
 * booking made by phone, or the whole price. Adds to `amount_paid_eur` and
 * moves `payment_status` forward; it never lowers either.
 */
export async function recordCounterPayment(
  accessToken: string | null,
  input: { bookingId: string; amountEur: number; method: BalanceMethod },
): Promise<{ error: string | null }> {
  let actor;
  try {
    actor = await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!METHODS.includes(input.method)) return { error: "invalid_method" };
  if (!Number.isFinite(input.amountEur) || input.amountEur <= 0) {
    return { error: "invalid_amount" };
  }

  const db = getAdminClient().database;
  const { data } = await db
    .from("bookings")
    .select("price_eur, amount_paid_eur, payment_status, payment_mode")
    .eq("id", input.bookingId)
    .maybeSingle();
  const row = data as {
    price_eur: number | string | null;
    amount_paid_eur: number | string | null;
    payment_status: string;
    payment_mode: string | null;
  } | null;
  if (!row) return { error: "not_found" };
  // Paid for when the bonus was bought; money here would count it twice.
  if (row.payment_mode === "bonus") return { error: "bonus_booking" };

  const price = Number(row.price_eur ?? 0);
  const paid = Number(row.amount_paid_eur ?? 0) + input.amountEur;
  const status = paymentStatusAfter(paid, price);
  const owed = amountOwed(price, paid);

  // Conditioned on the amount read above: a double click, or two people at
  // the desk at once, must not add the same money twice.
  const { data: applied, error } = await db
    .from("bookings")
    .update({
      amount_paid_eur: paid,
      payment_status: status,
      ...(owed === 0
        ? {
            balance_settled_at: new Date().toISOString(),
            balance_settled_method: input.method,
          }
        : {}),
    })
    .eq("id", input.bookingId)
    .eq("amount_paid_eur", Number(row.amount_paid_eur ?? 0))
    .select("id");
  if (error) return { error: error.message };
  if (((applied ?? []) as unknown[]).length === 0) return { error: "conflict" };

  await recordBookingEvent({
    bookingId: input.bookingId,
    channel: "payment",
    event: "paid",
    actorId: actor.userId,
    actorRole: actor.role as BookingEventActorRole,
    summary:
      `Cobrado en el centro · ${formatPrice(input.amountEur, "es")} (${input.method})` +
      (owed > 0 ? ` · pendiente ${formatPrice(owed, "es")}` : ""),
    payload: {
      amountEur: input.amountEur,
      method: input.method,
      owedEur: owed,
    },
  });
  return { error: null };
}
