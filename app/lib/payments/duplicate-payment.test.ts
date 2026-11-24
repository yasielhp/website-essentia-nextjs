import { describe, expect, it } from "bun:test";
import type { PaymentEntry } from "@/lib/bookings/refund-rules";
import { judgeArrival } from "./duplicate-payment";

const X = "790098209516";
const Y = "790098299999";
const unpaid = { payment_status: "pending", amount_paid_eur: 0 };
const paid = { payment_status: "paid", amount_paid_eur: 130 };
const entry = (
  event: string,
  provider_id: string | null,
  actor_role = "system",
): PaymentEntry => ({
  event,
  actor_role,
  provider_id,
  payload: { amountEur: 130 },
  created_at: "2026-11-24T10:00:00Z",
});

describe("judgeArrival", () => {
  it("the first money for the booking is applied", () => {
    expect(
      judgeArrival(unpaid, [entry("checkout", X, "anonymous")], X),
    ).toEqual({ kind: "apply" });
  });

  it("the same order again is a retry, whether it was paid or a duplicate", () => {
    expect(judgeArrival(paid, [entry("paid", X)], X)).toEqual({
      kind: "retry",
    });
    expect(
      judgeArrival(paid, [entry("paid", X), entry("duplicate", Y)], Y),
    ).toEqual({ kind: "retry" });
  });

  it("another order for a booking already paid is a duplicate, naming the first", () => {
    expect(judgeArrival(paid, [entry("paid", X)], Y)).toEqual({
      kind: "duplicate",
      firstOrderId: X,
    });
  });

  it("an online payment for a booking paid at the desk, or refunded, is a duplicate too", () => {
    expect(judgeArrival(paid, [entry("paid", null, "admin")], Y)).toEqual({
      kind: "duplicate",
      firstOrderId: null,
    });
    expect(
      judgeArrival(
        { payment_status: "refunded", amount_paid_eur: 130 },
        [entry("paid", X)],
        Y,
      ),
    ).toEqual({ kind: "duplicate", firstOrderId: X });
  });

  it("an opened checkout is not a payment", () => {
    expect(
      judgeArrival(unpaid, [entry("checkout", X, "anonymous")], Y),
    ).toEqual({ kind: "apply" });
  });
});

describe("judgeArrival, before the winner's entry is written", () => {
  const paidUnder = (order: string, extra: Record<string, unknown> = {}) => ({
    payment_status: "paid",
    amount_paid_eur: 130,
    stripe_session_id: order,
    balance_settled_method: null,
    ...extra,
  });

  it("the order the update wrote, arriving again, is a retry", () => {
    expect(judgeArrival(paidUnder(X), [], X)).toEqual({ kind: "retry" });
  });

  it("another order is a duplicate of the one the update wrote", () => {
    expect(judgeArrival(paidUnder(X), [], Y)).toEqual({
      kind: "duplicate",
      firstOrderId: X,
    });
  });

  it("a booking paid at the desk under an old checkout's order is not taken for that order's payment", () => {
    expect(
      judgeArrival(paidUnder(Y, { balance_settled_method: "cash" }), [], Y),
    ).toEqual({ kind: "duplicate", firstOrderId: null });
  });
});
