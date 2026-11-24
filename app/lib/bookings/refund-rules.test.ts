import { describe, expect, it } from "bun:test";
import { bookingMoney, heldEur, ledgerTotals } from "@/lib/payments/ledger";
import {
  cancelErasesOnlinePayment,
  duplicateRefunds,
  onlinePayment,
  refundOnCancel,
  refundOpen,
  refundPatch,
  refundState,
  refundView,
  refundableEur,
  suspectedOnline,
  teamChoiceOnSave,
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

  it("an order number and a paid status are not proof: without the webhook's entry nothing is online", () => {
    expect(onlinePayment(paidOnline, [])).toEqual({
      orderId: null,
      onlineEur: 0,
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

describe("the latest word on the refund decides", () => {
  const stateOf = (booking: RefundBooking, entries: PaymentEntry[]) =>
    refundView(booking, entries, true).state;

  it("owed by the link, reactivated, then cancelled 2 h before with no refund: nothing pending", () => {
    // The sequence a review reproduced: the page went on saying 100 € owed.
    const entries = [
      redsysPaid(100),
      entry("refund_owed", 100, { actor_role: "client" }),
      entry("refund_waived", 100, { actor_role: "admin" }), // reactivated
      entry("refund_waived", 100, { actor_role: "admin" }), // late, no refund
    ];
    expect(stateOf(paidOnline, entries)).toEqual({ kind: "none" });
  });

  it("a later refund_waived settles an earlier refund_owed even with no reactivation entry", () => {
    const entries = [
      redsysPaid(100),
      entry("refund_owed", 100),
      entry("refund_waived", 100),
    ];
    expect(stateOf(paidOnline, entries)).toEqual({ kind: "none" });
  });

  it("owed, reactivated (the booking is no longer cancelled): nothing pending", () => {
    const entries = [redsysPaid(100), entry("refund_owed", 100)];
    expect(stateOf({ ...paidOnline, status: "confirmed" }, entries)).toEqual({
      kind: "none",
    });
  });

  it("waived, then cancelled again in time: owed once, not twice", () => {
    const entries = [
      redsysPaid(100),
      entry("refund_owed", 100),
      entry("refund_waived", 100),
      entry("refund_owed", 100),
    ];
    expect(stateOf(paidOnline, entries)).toEqual({
      kind: "owed",
      amountEur: 100,
    });
  });

  it("owed, then returned: refunded", () => {
    const entries = [
      redsysPaid(100),
      entry("refund_owed", 100),
      entry("refunded", 100, { actor_role: "admin" }),
    ];
    expect(
      stateOf({ ...paidOnline, payment_status: "refunded" }, entries),
    ).toEqual({ kind: "refunded", amountEur: 100 });
  });

  it("an entry that records a doubt (status failed) is not a word on it", () => {
    const entries = [
      redsysPaid(100),
      entry("refund_owed", 100, { status: "failed" }),
    ];
    expect(stateOf(paidOnline, entries)).toEqual({ kind: "none" });
    const later = [
      redsysPaid(100),
      entry("refund_owed", 100),
      entry("refund_waived", 100, { status: "failed" }),
    ];
    expect(stateOf(paidOnline, later)).toEqual({
      kind: "owed",
      amountEur: 100,
    });
  });
});

describe("refundPatch and the ledger", () => {
  it("returning everything makes the booking refunded and takes it out of income", () => {
    const patch = refundPatch(paidOnline, 100);
    expect(patch).toEqual({ payment_status: "refunded", amount_paid_eur: 100 });
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
      amount_paid_eur: 99.99,
    });
  });

  it("40 € and then the last 60 €: the refunded row says 100 €, and nothing is income", () => {
    const first = refundPatch(paidOnline, 40);
    expect(first).toEqual({ amount_paid_eur: 60 });
    const afterFirst = { ...paidOnline, ...first };
    // The second mark knows what the first returned (the history's entries).
    const second = refundPatch(afterFirst, 60, 40);
    expect(second).toEqual({
      payment_status: "refunded",
      amount_paid_eur: 100,
    });
    const money = bookingMoney({ ...afterFirst, price_eur: 100, ...second });
    expect(money).toMatchObject({ status: "refunded", amount: 100 });
    expect(ledgerTotals([money]).revenue).toBe(0);
    expect(heldEur({ ...afterFirst, ...second })).toBe(0);
  });

  it("the money a booking still holds: a part refund keeps the rest, a refund nothing", () => {
    expect(heldEur({ ...paidOnline, amount_paid_eur: 60 })).toBe(60);
    expect(heldEur({ payment_status: "refunded", amount_paid_eur: 100 })).toBe(
      0,
    );
    expect(heldEur({ payment_status: "pending", amount_paid_eur: null })).toBe(
      0,
    );
  });
});

describe("teamChoiceOnSave: what the edit screen showed is what is recorded", () => {
  it("shown as owed (24 hours or more when chosen): sent as a refund, ticked or not", () => {
    expect(
      teamChoiceOnSave({
        refundableEur: 100,
        shownInAdvance: true,
        ticked: false,
      }),
    ).toBe(true);
  });

  it("inside the 24 hours: the box decides", () => {
    expect(
      teamChoiceOnSave({
        refundableEur: 100,
        shownInAdvance: false,
        ticked: false,
      }),
    ).toBe(false);
    expect(
      teamChoiceOnSave({
        refundableEur: 100,
        shownInAdvance: false,
        ticked: true,
      }),
    ).toBe(true);
  });

  it("nothing paid online: nothing to choose", () => {
    expect(
      teamChoiceOnSave({
        refundableEur: 0,
        shownInAdvance: true,
        ticked: true,
      }),
    ).toBe(false);
  });
});

describe("cancelErasesOnlinePayment", () => {
  const entries = [redsysPaid(100)];
  const open = { ...paidOnline, status: "confirmed" };

  it("a save that sets the payment back to unpaid, or lowers it, would erase it", () => {
    expect(
      cancelErasesOnlinePayment(open, entries, {
        payment_status: "pending",
        amount_paid_eur: 0,
      }),
    ).toBe(true);
    expect(
      cancelErasesOnlinePayment(open, entries, {
        payment_status: "paid",
        amount_paid_eur: 50,
      }),
    ).toBe(true);
  });

  it("leaving the payment as it is, or raising it, erases nothing", () => {
    expect(cancelErasesOnlinePayment(open, entries, {})).toBe(false);
    expect(
      cancelErasesOnlinePayment(open, entries, {
        payment_status: "paid",
        amount_paid_eur: 100,
      }),
    ).toBe(false);
  });

  it("a booking with nothing paid online has nothing to erase", () => {
    expect(
      cancelErasesOnlinePayment(
        { ...open, stripe_session_id: null, payment_status: "pending" },
        [],
        { payment_status: "pending" },
      ),
    ).toBe(false);
  });
});

describe("suspectedOnline: looks paid online, no Redsys payment on record", () => {
  it("is a booking paid under an order with no webhook entry and nothing taken at the desk", () => {
    expect(suspectedOnline(paidOnline, [])).toEqual({
      orderId: ORDER,
      amountEur: 100,
    });
  });

  it("is nothing once the Redsys payment is on record", () => {
    expect(suspectedOnline(paidOnline, [redsysPaid(100)])).toBeNull();
  });

  it("is nothing for an abandoned checkout paid at the desk, or a bonus, or no order", () => {
    expect(
      suspectedOnline({ ...paidOnline, balance_settled_method: "cash" }, []),
    ).toBeNull();
    expect(
      suspectedOnline({ ...paidOnline, payment_mode: "bonus" }, []),
    ).toBeNull();
    expect(
      suspectedOnline({ ...paidOnline, stripe_session_id: null }, []),
    ).toBeNull();
    expect(
      suspectedOnline({ ...paidOnline, payment_status: "pending" }, []),
    ).toBeNull();
  });

  it("is never owed: the view asks to check, and an administrator may still mark it", () => {
    const view = refundView(paidOnline, [], true);
    expect(view).toMatchObject({
      orderId: ORDER,
      onlineEur: 0,
      unverifiedEur: 100,
      state: { kind: "none" },
      refundableEur: 100,
      canMark: true,
    });
  });
});

describe("duplicate payments are kept apart from the booking's own refund", () => {
  const Y = "790098299999";
  const dup = (event: string, amountEur: number) =>
    entry(event, amountEur, {
      provider_id: Y,
      payload: { amountEur, orderId: Y, duplicate: true },
    });

  it("owed on their own order, less what was returned on it", () => {
    const entries = [
      redsysPaid(100),
      dup("duplicate", 100),
      dup("refund_owed", 100),
    ];
    expect(duplicateRefunds(entries)).toEqual([
      { orderId: Y, amountEur: 100, owedEur: 100 },
    ]);
    expect(duplicateRefunds([...entries, dup("refunded", 100)])).toEqual([
      { orderId: Y, amountEur: 100, owedEur: 0 },
    ]);
  });

  it("they owe nothing on the booking itself, and returning one does not count as its refund", () => {
    const entries = [
      redsysPaid(100),
      dup("refund_owed", 100),
      dup("refunded", 100),
    ];
    const view = refundView(
      { ...paidOnline, status: "confirmed" },
      entries,
      true,
    );
    expect(view.state).toEqual({ kind: "none" });
    expect(view.onlineEur).toBe(100);
    expect(
      refundableEur(paidOnline, entries, onlinePayment(paidOnline, entries)),
    ).toBe(100);
  });
});

describe("refundOpen: when money may be owed back without a cancellation", () => {
  const slotTaken = (amountEur: number) =>
    entry("refund_owed", amountEur, {
      payload: { amountEur, reason: "slot_taken" },
    });

  it("a cancelled booking, always", () => {
    expect(refundOpen({ status: "cancelled" }, [])).toBe(true);
  });

  it("a draft whose payment arrived for an hour already taken", () => {
    const entries = [redsysPaid(100), slotTaken(100)];
    expect(refundOpen({ status: "draft" }, entries)).toBe(true);
    const draft = { ...paidOnline, status: "draft" };
    expect(refundState(draft, entries, onlinePayment(draft, entries))).toEqual({
      kind: "owed",
      amountEur: 100,
    });
    expect(refundView(draft, entries, true).canMark).toBe(true);
  });

  it("not once that refund was withdrawn (rebooked), nor any other draft, nor a live booking", () => {
    expect(
      refundOpen({ status: "draft" }, [
        redsysPaid(100),
        slotTaken(100),
        entry("refund_waived", 100),
      ]),
    ).toBe(false);
    expect(refundOpen({ status: "draft" }, [redsysPaid(100)])).toBe(false);
    expect(
      refundOpen({ status: "confirmed" }, [redsysPaid(100), slotTaken(100)]),
    ).toBe(false);
  });
});
