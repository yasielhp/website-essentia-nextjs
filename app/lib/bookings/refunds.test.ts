import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { formatPrice } from "@/utils/format";
import { staffRefundOwedEmail } from "@/emails/templates/staff-refund-owed";

/**
 * The real `settleRefundOnCancel`, with the database, the mailer and the
 * history replaced: what the team's cancellations (dashboard, assistant)
 * record about the money, and when the office is emailed.
 */

const EUR100 = formatPrice(100, "es");
// 10:00 in the Canaries on 15 July (summer) is 09:00 UTC.
const SESSION = { date: "2026-07-15", time: "10:00" };
const at = (iso: string) => Date.parse(iso);

let bookingRow: Record<string, unknown> | null = null;
let entries: Record<string, unknown>[] = [];
let entriesError: unknown = null;
let sent: { to: string; subject: string; html: string }[] = [];
let recorded: {
  event?: string;
  channel?: string;
  summary?: string;
  actorRole?: string | null;
  status?: string;
  payload?: Record<string, unknown> | null;
}[] = [];

function chain(table: string): unknown {
  const result = () => {
    if (table === "bookings") return { data: bookingRow, error: null };
    if (table === "booking_events") {
      return { data: entriesError ? null : entries, error: entriesError };
    }
    if (table === "profiles") {
      return { data: { email: "office@example.test" }, error: null };
    }
    return { data: null, error: null };
  };
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve(result()).then(ok, bad);
      }
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  send: { ...(await import("@/emails/send")) },
  record: { ...(await import("@/lib/booking-events/record")) },
};
let settleRefundOnCancel: typeof import("./refunds").settleRefundOnCancel;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL ??= "https://app.example.test";
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({ database: { from: (t: string) => chain(t) } }),
  }));
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmail: async (m: (typeof sent)[number]) => {
      sent.push(m);
      return { error: null, id: "re-1" };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (e: (typeof recorded)[number]) => {
      recorded.push(e);
    },
  }));
  ({ settleRefundOnCancel } = await import("./refunds"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/lib/booking-events/record", () => real.record);
});

beforeEach(() => {
  bookingRow = {
    id: "b-1",
    status: "cancelled",
    payment_status: "paid",
    payment_mode: "full",
    amount_paid_eur: "100.00",
    stripe_session_id: "790098209516",
    balance_settled_method: null,
    first_name: "Ana",
    last_name: "García",
    email: "ana@example.test",
    service_title: "Manual Therapies",
    ...SESSION,
    service_tiers: { label: "Drenaje" },
  };
  entries = [
    {
      event: "paid",
      actor_role: "system",
      provider_id: "790098209516",
      payload: { amountEur: 100 },
      created_at: "2026-07-01T10:00:00Z",
    },
  ];
  entriesError = null;
  sent = [];
  recorded = [];
});

const team = (now: string, teamRefundsLate?: boolean) =>
  settleRefundOnCancel({
    bookingId: "b-1",
    source: "dashboard",
    actorId: "u-1",
    actorRole: "admin",
    ...SESSION,
    teamRefundsLate,
    now: at(now),
  });

describe("a cancellation by the team", () => {
  test("30 hours before: owed, and the office is emailed the order", async () => {
    const res = await team("2026-07-14T03:00:00Z");
    expect(res).toMatchObject({
      owed: true,
      amountEur: 100,
      orderId: "790098209516",
      reason: "in_advance",
    });
    const owed = recorded.find((e) => e.channel === "payment");
    expect(owed).toMatchObject({ event: "refund_owed", actorRole: "admin" });
    expect(owed?.summary).toBe(
      `Reembolso pendiente · ${EUR100} · pedido 790098209516 · cancelada con 30 h de antelación`,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("office@example.test");
    expect(sent[0]!.html).toContain("por el equipo, desde el panel");
    // The email is in the history too, as sent.
    expect(recorded.find((e) => e.channel === "email")?.status).toBe("sent");
  });

  test("5 hours before, by default: no refund, said in the history, nobody emailed", async () => {
    const res = await team("2026-07-15T04:00:00Z");
    expect(res).toMatchObject({ owed: false, reason: "late" });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ event: "refund_waived" });
    expect(recorded[0]!.summary).toBe(
      "Sin reembolso · cancelada con 5 h de antelación (menos de 24 h) · decisión del equipo",
    );
    expect(sent).toEqual([]);
  });

  test("5 hours before, when the team chooses to refund: owed, and the email says it was their choice", async () => {
    const res = await team("2026-07-15T04:00:00Z", true);
    expect(res).toMatchObject({ owed: true, reason: "late_team_refunds" });
    expect(recorded[0]!.summary).toContain("el equipo decide devolverlo");
    expect(sent[0]!.html).toContain("el equipo ha decidido devolverlo");
  });

  test("after the session had begun, the same rule as late", async () => {
    const res = await team("2026-07-15T12:00:00Z");
    expect(res.owed).toBe(false);
    expect(recorded[0]!.summary).toContain("después de la hora de la sesión");
  });

  test("nothing paid online: nothing written, nobody emailed", async () => {
    bookingRow = {
      ...bookingRow,
      payment_status: "pending",
      amount_paid_eur: 0,
      stripe_session_id: null,
    };
    entries = [];
    const res = await team("2026-07-13T09:00:00Z");
    expect(res).toMatchObject({ owed: false, reason: "nothing_online" });
    expect(recorded).toEqual([]);
    expect(sent).toEqual([]);
  });

  test("already refunded: nothing owed twice", async () => {
    bookingRow = { ...bookingRow, payment_status: "refunded" };
    const res = await team("2026-07-13T09:00:00Z");
    expect(res.owed).toBe(false);
    expect(sent).toEqual([]);
  });

  test("a history that cannot be read says nothing rather than something wrong", async () => {
    entriesError = { message: "down" };
    const res = await team("2026-07-13T09:00:00Z");
    expect(res.owed).toBe(false);
    expect(recorded).toEqual([]);
  });

  test("a mailer that throws still leaves the debt recorded, and never throws", async () => {
    mock.module("@/emails/send", () => ({
      ...real.send,
      sendEmail: async () => {
        throw new Error("smtp down");
      },
    }));
    const { settleRefundOnCancel: settle } = await import("./refunds");
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const res = await settle({
      bookingId: "b-1",
      source: "assistant",
      actorRole: "staff",
      ...SESSION,
      now: at("2026-07-13T09:00:00Z"),
    });
    quiet.mockRestore();
    expect(res.owed).toBe(true);
    expect(recorded.find((e) => e.channel === "payment")?.event).toBe(
      "refund_owed",
    );
    expect(recorded.find((e) => e.channel === "email")?.status).toBe("failed");
    mock.module("@/emails/send", () => ({
      ...real.send,
      sendEmail: async (m: (typeof sent)[number]) => {
        sent.push(m);
        return { error: null, id: "re-1" };
      },
    }));
  });
});

describe("staffRefundOwedEmail", () => {
  test("escapes what it is given and names the order", () => {
    const html = staffRefundOwedEmail({
      clientName: "<b>Ana</b>",
      clientEmail: "ana@example.test",
      service: "Manual Therapies",
      session: "miércoles, 15 de julio de 2026, 10:00",
      amount: EUR100,
      orderId: "790098209516",
      source: "client_link",
      late: false,
      bookingUrl: "https://app.example.test/dashboard/bookings/b-1",
    });
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).toContain("790098209516");
    expect(html).toContain("por el cliente, desde el enlace del correo");
  });

  test("speaks English when asked, and says when there is no order number", () => {
    const html = staffRefundOwedEmail({
      locale: "en",
      clientName: "Ana",
      clientEmail: null,
      service: "Manual Therapies",
      session: "15 July 2026, 10:00",
      amount: "€100.00",
      orderId: null,
      source: "dashboard",
      late: true,
      bookingUrl: "https://app.example.test/dashboard/bookings/b-1",
    });
    expect(html).toContain("Refund pending");
    expect(html).toContain("no number (look it up by date and amount)");
    expect(html).toContain("the team decided to refund it");
  });
});
