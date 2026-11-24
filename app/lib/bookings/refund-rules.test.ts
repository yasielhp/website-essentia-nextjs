import { describe, expect, it } from "bun:test";
import { bookingMoney, ledgerTotals } from "@/lib/payments/ledger";
import {
  onlinePayment,
  refundOnCancel,
  refundPatch,
  refundState,
  refundView,
  refundableEur,
  type PaymentEntry,
  type RefundBooking,
} from "./refund-rules";

const ORDER = "790098209516";

const paidOnline: RefundBooking = {
  status: "cancelled",
  payment_status: "paid",
  payment_mode: "full",
  amount_paid_eur: "100.00",
  stripe_session_id: ORDER,
  balance_settled_method: null,
};

let clock = 0;
const entry = (
  event: string,
  amountEur: number,
  extra: Partial<PaymentEntry> = {},
): PaymentEntry => ({
  event,
  actor_role: "system",
  provider_id: null,
  payload: { amountEur },
  created_at: new Date(Date.UTC(2026, 8, 1, 0, clock++)).toISOString(),
  ...extra,
});
/** The entry the Redsys webhook writes for a payment. */
const redsysPaid = (amountEur: number, order = ORDER) =>
  entry("paid", amountEur, { provider_id: order });
/** A payment taken at the desk: a person, no order number. */
const deskPaid = (amountEur: number) =>
  entry("paid", amountEur, { actor_role: "admin" });

describe("onlinePayment", () => {
  it("is what the Redsys webhook recorded, with its order", () => {
    expect(onlinePayment(paidOnline, [redsysPaid(100)])).toEqual({
      orderId: ORDER,
      onlineEur: 100,
    });
  });

  it("does not count money taken at the desk", () => {
    expect(
      onlinePayment({ ...paidOnline, stripe_session_id: null }, [deskPaid(100)])
        .onlineEur,
    ).toBe(0);
  });

  it("an abandoned checkout leaves an order number but no online money", () => {
    // The order is written when the checkout starts; the desk took the money.
    expect(
      onlinePayment({ ...paidOnline, balance_settled_method: "cash" }, [
        deskPaid(100),
      ]),
    ).toEqual({ orderId: null, onlineEur: 0 });
  });

  it("falls back to the booking's own amount when the webhook's entry is missing", () => {
    expect(onlinePayment(paidOnline, [])).toEqual({
      orderId: ORDER,
      onlineEur: 100,
    });
  });

  it("a bonus session holds no online money of its own", () => {
    expect(
      onlinePayment({ ...paidOnline, payment_mode: "bonus" }, [redsysPaid(100)])
        .onlineEur,
    ).toBe(0);
  });
});

describe("refundOnCancel", () => {
  it("owes the money at least 24 hours before, whoever cancels", () => {
    for (const by of ["client", "team"] as const) {
      expect(refundOnCancel({ onlineEur: 100, hoursBefore: 24, by })).toEqual({
        owed: true,
        reason: "in_advance",
      });
    }
  });

  it("owes nothing inside the last 24 hours by default", () => {
    expect(
      refundOnCancel({ onlineEur: 100, hoursBefore: 23.9, by: "client" }),
    ).toEqual({ owed: false, reason: "late" });
    expect(
      refundOnCancel({ onlineEur: 100, hoursBefore: 5, by: "team" }),
    ).toEqual({ owed: false, reason: "late" });
  });

  it("lets the team refund a late cancellation, never the client", () => {
    expect(
      refundOnCancel({
        onlineEur: 100,
        hoursBefore: 5,
        by: "team",
        teamRefundsLate: true,
      }),
    ).toEqual({ owed: true, reason: "late_team_refunds" });
    expect(
      refundOnCancel({
        onlineEur: 100,
        hoursBefore: 5,
        by: "client",
        teamRefundsLate: true,
      }).owed,
    ).toBe(false);
  });

  it("has nothing to say when nothing was paid online", () => {
    expect(
      refundOnCancel({ onlineEur: 0, hoursBefore: 48, by: "client" }),
    ).toEqual({ owed: false, reason: "nothing_online" });
  });
});

describe("refundState and refundableEur", () => {
  it("is owed after a refund_owed entry, for the amount it named", () => {
    const entries = [redsysPaid(100), entry("refund_owed", 100)];
    const online = onlinePayment(paidOnline, entries);
    expect(refundState(paidOnline, entries, online)).toEqual({
      kind: "owed",
      amountEur: 100,
    });
    expect(refundableEur(paidOnline, entries, online)).toBe(100);
  });

  it("is refunded once the booking is marked so", () => {
    const entries = [
      redsysPaid(100),
      entry("refund_owed", 100),
      entry("refunded", 100, { actor_role: "admin" }),
    ];
    const booking = { ...paidOnline, payment_status: "refunded" };
    const online = onlinePayment(booking, entries);
    expect(refundState(booking, entries, online)).toEqual({
      kind: "refunded",
      amountEur: 100,
    });
    expect(refundableEur(booking, entries, online)).toBe(0);
  });

  it("keeps what is left owed after a part is returned", () => {
    const entries = [
      redsysPaid(100),
      entry("refund_owed", 100),
      entry("refunded", 40, { actor_role: "admin" }),
    ];
    const booking = { ...paidOnline, amount_paid_eur: 60 };
    const online = onlinePayment(booking, entries);
    expect(refundState(booking, entries, online)).toEqual({
      kind: "owed",
      amountEur: 60,
    });
    expect(refundableEur(booking, entries, online)).toBe(60);
  });

  it("owes nothing once the booking is no longer cancelled", () => {
    const entries = [redsysPaid(100), entry("refund_owed", 100)];
    const booking = { ...paidOnline, status: "confirmed" };
    expect(
      refundState(booking, entries, onlinePayment(booking, entries)).kind,
    ).toBe("none");
  });

  it("owes nothing for a late cancellation, though an admin may still return it", () => {
    const entries = [redsysPaid(100), entry("refund_waived", 100)];
    const view = refundView(paidOnline, entries, true);
    expect(view.state).toEqual({ kind: "none" });
    expect(view.refundableEur).toBe(100);
    expect(view.canMark).toBe(true);
    expect(view.orderId).toBe(ORDER);
  });

  it("only an administrator may mark it, and only on a cancelled booking", () => {
    const entries = [redsysPaid(100), entry("refund_owed", 100)];
    expect(refundView(paidOnline, entries, false).canMark).toBe(false);
    expect(
      refundView({ ...paidOnline, status: "confirmed" }, entries, true).canMark,
    ).toBe(false);
  });
});

describe("refundPatch and the ledger", () => {
  it("returning everything makes the booking refunded and takes it out of income", () => {
    const patch = refundPatch(paidOnline, 100);
    expect(patch).toEqual({ payment_status: "refunded" });
    const row = {
      ...paidOnline,
      price_eur: 100,
      ...patch,
    };
    const money = bookingMoney(row);
    expect(money.status).toBe("refunded");
    expect(ledgerTotals([money]).revenue).toBe(0);
    // Before the refund the same row was counted as income.
    expect(
      ledgerTotals([bookingMoney({ ...paidOnline, price_eur: 100 })]).revenue,
    ).toBe(100);
  });

  it("returning a part keeps the rest as income", () => {
    const patch = refundPatch(paidOnline, 30);
    expect(patch).toEqual({ amount_paid_eur: 70 });
    const money = bookingMoney({ ...paidOnline, price_eur: 100, ...patch });
    expect(ledgerTotals([money]).revenue).toBe(70);
  });

  it("works in cents, so 99,99 € of 99,99 € is everything", () => {
    expect(refundPatch({ amount_paid_eur: "99.99" }, 99.99)).toEqual({
      payment_status: "refunded",
    });
  });
});
