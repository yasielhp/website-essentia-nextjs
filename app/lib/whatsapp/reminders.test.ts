import { describe, expect, it, spyOn } from "bun:test";
import {
  chainDb,
  filters,
  has,
  argsOf,
  type Step,
} from "@/lib/campaigns/fake-db";
import { template } from "@/lib/campaigns/whatsapp-fixtures";
import type { BookingEventInput } from "@/lib/booking-events/types";
import type { TemplateSend } from "./client";
import { makeClientDeps, type ClientWhatsAppDeps } from "./notify-client";
import {
  CRON_MAX_MS,
  reminderBudgetMs,
  sendWhatsAppReminders,
} from "./reminders";
import type { WhatsAppSendResult } from "./types";

const NOW = Date.parse("2026-12-08T10:00:00");
const pad = (n: number) => String(n).padStart(2, "0");
const dayAt = (hours: number) => {
  const d = new Date(NOW + hours * 3_600_000);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

const TEMPLATE = template({
  id: "tpl-r",
  name: "recordatorio_cita",
  category: "UTILITY",
  body: "Hola {{1}}, mañana tienes {{2}} a las {{3}}.",
  param_count: 3,
});
const ROW = {
  locale: "es",
  enabled: true,
  whatsapp_template_id: "tpl-r",
  whatsapp_params: [
    { kind: "field", field: "first_name" },
    { kind: "field", field: "service" },
    { kind: "field", field: "time" },
  ],
};
const CONSENTING = {
  email: "ana@example.test",
  first_name: "Ana",
  last_name: "García",
  phone: "600 11 22 33",
  preferred_language: "es",
  whatsapp_opted_in_at: "2026-11-01T00:00:00Z",
  whatsapp_opted_out_at: null,
  whatsapp_unreachable_at: null,
};

type B = ReturnType<typeof booking>;
const booking = (
  id: string,
  hoursAhead: number,
  over: Record<string, unknown> = {},
) => ({
  id,
  email: "Ana@Example.test",
  contact_id: "c-1",
  phone: null as string | null,
  first_name: "Ana",
  last_name: "García",
  service_title: "Drenaje linfático",
  ...dayAt(hoursAhead),
  service_tiers: { label: "Sesión individual" },
  ...over,
});

type World = {
  rows?: unknown[] | null;
  bookings?: B[];
  contacts?: Record<string, unknown>[];
  template?: unknown;
  /** Bookings whose email reminder was already sent: the WhatsApp one is independent. */
  emailStamped?: string[];
  stamped?: Set<string>;
  /** E.164 phones on the STOP list; null makes the list unreadable. */
  suppressed?: string[] | null;
};

function world(w: World = {}) {
  const stamped = w.stamped ?? new Set<string>();
  const sent: TemplateSend[] = [];
  const recorded: BookingEventInput[] = [];
  const order: string[] = [];
  const claimFilters: Record<string, unknown>[] = [];
  const selects: Step[][] = [];
  let answer: (
    s: TemplateSend,
  ) => WhatsAppSendResult | Promise<WhatsAppSendResult> = () => ({
    status: "sent",
    providerId: "wamid.r",
  });

  const { db, log } = chainDb(async (table, chain) => {
    if (table === "message_templates") {
      return { data: w.rows === undefined ? [ROW] : w.rows, error: null };
    }
    if (table === "whatsapp_templates") {
      return { data: "template" in w ? w.template : TEMPLATE, error: null };
    }
    if (table === "contacts") {
      return { data: w.contacts ?? [CONSENTING], error: null };
    }
    if (table === "bookings") {
      if (has(chain, "update")) {
        const f = filters(chain);
        claimFilters.push(f);
        const patch = argsOf(chain, "update")![0] as Record<string, unknown>;
        if (!("whatsapp_reminder_sent_at" in patch))
          throw new Error("touched another column");
        const id = f.id as string;
        if (stamped.has(id)) return { data: [], error: null };
        stamped.add(id);
        order.push(`claim:${id}`);
        return { data: [{ id }], error: null };
      }
      selects.push(chain);
      return {
        data: (w.bookings ?? []).filter((b) => !stamped.has(b.id)),
        error: null,
      };
    }
    if (table === "whatsapp_suppressed_phones") {
      return w.suppressed === null
        ? { data: null, error: { message: "relation does not exist" } }
        : {
            data: (w.suppressed ?? []).map((phone) => ({ phone })),
            error: null,
          };
    }
    return { data: [], error: null };
  });

  const deps: ClientWhatsAppDeps = {
    ...makeClientDeps(db),
    db,
    isConfigured: () => true,
    send: async (s) => {
      order.push(`send:${s.to}`);
      sent.push(s);
      return answer(s);
    },
    record: async (e) => {
      recorded.push(e);
    },
  };
  return {
    deps,
    log,
    sent,
    recorded,
    order,
    stamped,
    claimFilters,
    selects,
    setAnswer: (fn: typeof answer) => {
      answer = fn;
    },
  };
}

const run = (
  w: ReturnType<typeof world>,
  extra: Record<string, unknown> = {},
) => sendWhatsAppReminders({ now: NOW, ...extra }, w.deps);

describe("sendWhatsAppReminders — when there is nothing to do", () => {
  it("with WhatsApp not configured it touches nothing", async () => {
    const w = world();
    const out = await sendWhatsAppReminders(
      { now: NOW },
      { ...w.deps, isConfigured: () => false },
    );
    expect(w.log).toHaveLength(0);
    expect(out.sent).toBe(0);
  });

  it("with no saved row it reads that one row and stops", async () => {
    const w = world({ rows: [], bookings: [booking("b-1", 48)] });
    await run(w);
    expect(w.log.map((q) => q.table)).toEqual(["message_templates"]);
  });

  it("a reminder switched off sends nothing and stamps nothing", async () => {
    const w = world({
      rows: [{ ...ROW, enabled: false }],
      bookings: [booking("b-1", 48)],
    });
    await run(w);
    expect(w.sent).toHaveLength(0);
    expect(w.stamped.size).toBe(0);
  });

  it("a booking outside the window is left alone", async () => {
    const w = world({
      bookings: [booking("soon", 10), booking("far", 100), booking("ok", 48)],
    });
    await run(w);
    expect(w.stamped).toEqual(new Set(["ok"]));
    expect(w.sent).toHaveLength(1);
  });

  it("a client without the consent, or opted out, or unreachable, or with no number: no stamp, no send, no history", async () => {
    for (const contact of [
      { ...CONSENTING, whatsapp_opted_in_at: null },
      { ...CONSENTING, whatsapp_opted_out_at: "2026-11-05T00:00:00Z" },
      { ...CONSENTING, whatsapp_unreachable_at: "2026-11-05T00:00:00Z" },
      { ...CONSENTING, phone: null },
    ]) {
      const w = world({ bookings: [booking("b-1", 48)], contacts: [contact] });
      await run(w);
      expect(w.sent).toHaveLength(0);
      expect(w.recorded).toHaveLength(0);
      expect(w.stamped.size).toBe(0);
    }
    const noContact = world({ bookings: [booking("b-1", 48)], contacts: [] });
    await run(noContact);
    expect(noContact.sent).toHaveLength(0);
    expect(noContact.stamped.size).toBe(0);
  });

  it("only the language the booking is in: an English client with a Spanish row only gets nothing", async () => {
    const w = world({
      bookings: [booking("b-1", 48)],
      contacts: [{ ...CONSENTING, preferred_language: "en" }],
    });
    await run(w);
    expect(w.sent).toHaveLength(0);
    expect(w.stamped.size).toBe(0);
  });
});

describe("sendWhatsAppReminders — numbers that said STOP", () => {
  it("a suppressed number is neither claimed nor written to nor recorded", async () => {
    const w = world({
      bookings: [booking("b-1", 48)],
      suppressed: ["+34600112233"],
    });
    const out = await run(w);
    expect(w.sent).toHaveLength(0);
    expect(w.recorded).toHaveLength(0);
    expect(w.stamped.size).toBe(0);
    expect(out.none).toBe(1);
  });

  it("with the list unreadable nobody is written to and nothing is stamped", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const w = world({ bookings: [booking("b-1", 48)], suppressed: null });
    await run(w);
    quiet.mockRestore();
    expect(w.sent).toHaveLength(0);
    expect(w.stamped.size).toBe(0);
  });

  it("the others in the run are not affected by one suppressed number", async () => {
    const w = world({
      bookings: [
        booking("b-1", 48),
        booking("b-2", 47, {
          email: "luis@example.test",
          phone: "611 22 33 44",
        }),
      ],
      contacts: [
        CONSENTING,
        { ...CONSENTING, email: "luis@example.test", first_name: "Luis" },
      ],
      suppressed: ["+34611223344"],
    });
    await run(w);
    expect(w.sent.map((s) => s.to)).toEqual(["+34600112233"]);
  });
});

describe("sendWhatsAppReminders — sending", () => {
  it("stamps the booking, then sends, then records a 'reminded' entry", async () => {
    const w = world({ bookings: [booking("b-1", 48)] });
    const out = await run(w);
    expect(w.order).toEqual(["claim:b-1", "send:+34600112233"]);
    expect(out.sent).toBe(1);
    expect(w.recorded).toHaveLength(1);
    expect(w.recorded[0]).toMatchObject({
      bookingId: "b-1",
      channel: "whatsapp",
      event: "reminded",
      actorRole: "system",
      status: "sent",
      providerId: "wamid.r",
      recipient: "+34600112233",
    });
    expect(w.recorded[0]?.summary).toContain(
      "Hola Ana, mañana tienes Drenaje linfático",
    );
    expect(w.sent[0]).toMatchObject({
      name: "recordatorio_cita",
      language: "es",
      bodyParams: [
        "Ana",
        "Drenaje linfático",
        expect.stringMatching(/^\d\d:\d\d$/),
      ],
    });
  });

  it("the claim is a conditional update on the WhatsApp stamp and on nothing else", async () => {
    const w = world({ bookings: [booking("b-1", 48)] });
    await run(w);
    expect(w.claimFilters).toEqual([{ id: "b-1" }]);
    const update = w.log.find(
      (q) => q.table === "bookings" && has(q.chain, "update"),
    )!;
    expect(has(update.chain, "is")).toBe(true);
    expect(argsOf(update.chain, "is")).toEqual([
      "whatsapp_reminder_sent_at",
      null,
    ]);
    expect(has(update.chain, "select")).toBe(true);
  });

  it("is independent of the email reminder: it selects on its own stamp only", async () => {
    const w = world({ bookings: [booking("b-1", 48)], emailStamped: ["b-1"] });
    await run(w);
    const text = JSON.stringify(w.selects);
    expect(text).toContain("whatsapp_reminder_sent_at");
    expect(text).not.toContain('"reminder_sent_at"');
    expect(w.sent).toHaveLength(1);
  });

  it("two overlapping runs send once", async () => {
    const w = world({ bookings: [booking("b-1", 48)] });
    const [a, b] = await Promise.all([run(w), run(w)]);
    expect(w.sent).toHaveLength(1);
    expect(a.sent + b.sent).toBe(1);
    expect(a.lost + b.lost).toBe(1);
    expect(w.recorded).toHaveLength(1);
  });

  it("a second run the next hour does not send again", async () => {
    const w = world({ bookings: [booking("b-1", 48)] });
    await run(w);
    await run(w);
    expect(w.sent).toHaveLength(1);
  });

  it("a refusal leaves the stamp: it is not retried every hour", async () => {
    const w = world({ bookings: [booking("b-1", 48)] });
    w.setAnswer(() => ({
      status: "failed",
      error: "Re-engagement",
      code: 131047,
    }));
    const out = await run(w);
    expect(out.failed).toBe(1);
    expect(w.stamped.has("b-1")).toBe(true);
    expect(w.recorded[0]).toMatchObject({
      status: "failed",
      event: "reminded",
    });
    await run(w);
    expect(w.sent).toHaveLength(1);
  });

  it("an ambiguous failure and a send that throws also leave the stamp", async () => {
    for (const fail of [
      () => ({ status: "failed" as const, error: "timeout", ambiguous: true }),
      () => {
        throw new Error("socket closed");
      },
    ]) {
      const w = world({ bookings: [booking("b-1", 48)] });
      w.setAnswer(fail);
      await run(w);
      await run(w);
      expect(w.sent).toHaveLength(1);
      expect(w.stamped.has("b-1")).toBe(true);
      expect(w.recorded[0]?.status).toBe("failed");
    }
  });

  it("a template that cannot be sent is one skipped entry, once, and the booking is stamped", async () => {
    const w = world({
      bookings: [booking("b-1", 48)],
      template: { ...TEMPLATE, status: "PAUSED" },
    });
    const out = await run(w);
    await run(w);
    expect(out.skipped).toBe(1);
    expect(w.sent).toHaveLength(0);
    expect(w.recorded).toHaveLength(1);
    expect(w.recorded[0]).toMatchObject({
      status: "skipped",
      event: "reminded",
    });
  });

  it("one booking's trouble does not stop the others", async () => {
    const w = world({
      bookings: [
        booking("b-1", 48),
        booking("b-2", 47, { email: "luis@example.test" }),
      ],
      contacts: [
        CONSENTING,
        { ...CONSENTING, email: "luis@example.test", first_name: "Luis" },
      ],
    });
    let calls = 0;
    w.setAnswer(() => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return { status: "sent", providerId: "wamid.2" };
    });
    const out = await run(w);
    expect(out.sent).toBe(1);
    expect(out.failed).toBe(1);
    expect(w.sent).toHaveLength(2);
  });

  it("stops when its time is up and leaves the rest unstamped for the next run", async () => {
    const w = world({
      bookings: [booking("b-1", 48), booking("b-2", 47), booking("b-3", 46)],
    });
    let t = 0;
    w.setAnswer(() => {
      t += 20_000;
      return { status: "sent", providerId: "x" };
    });
    const out = await sendWhatsAppReminders(
      { now: NOW, budgetMs: 30_000, clock: () => t },
      w.deps,
    );
    expect(out.sent).toBe(2);
    expect(w.stamped.has("b-3")).toBe(false);
  });

  it("a database that fails never throws", async () => {
    const w = world({ bookings: [booking("b-1", 48)] });
    const deps = {
      ...w.deps,
      db: {
        from() {
          throw new Error("no client");
        },
      } as unknown as ClientWhatsAppDeps["db"],
    };
    const out = await sendWhatsAppReminders({ now: NOW }, deps);
    expect(out.sent).toBe(0);
  });
});

describe("reminderBudgetMs", () => {
  it("is what is left of the cron's 60 seconds after the send timeout and a margin", () => {
    expect(reminderBudgetMs(0)).toBe(45_000);
    expect(reminderBudgetMs(10_000)).toBe(35_000);
  });
  it("is never negative: a slow email run leaves the WhatsApp ones for the next hour", () => {
    expect(reminderBudgetMs(60_000)).toBe(0);
    expect(reminderBudgetMs(600_000)).toBe(0);
  });
  it("the route declares the limit the budget is computed from", async () => {
    const route = await import("@/api/cron/booking-reminders/route");
    expect(route.maxDuration * 1000).toBe(CRON_MAX_MS);
  });
  it("a run with no time left claims and sends nothing", async () => {
    const w = world({ bookings: [booking("b-1", 48)] });
    let t = 0;
    const out = await sendWhatsAppReminders(
      { now: NOW, budgetMs: 0, clock: () => (t += 1) },
      w.deps,
    );
    expect(out.sent).toBe(0);
    expect(w.stamped.size).toBe(0);
  });
});
