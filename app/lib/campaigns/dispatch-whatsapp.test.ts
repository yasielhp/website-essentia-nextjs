import { describe, expect, test } from "bun:test";
import type { TemplateSend } from "@/lib/whatsapp/client";
import type {
  WhatsAppParamSource,
  WhatsAppSendResult,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import type { CampaignRow } from "@/types/campaign";
import {
  BUDGET_MS,
  PER_SECOND,
  UNCONFIRMED_PREFIX,
  sendQueuedWhatsApp,
  whatsappTemplateEligibility,
  type WhatsAppDeps,
} from "./dispatch-whatsapp";
import type { QueuedRow } from "./dispatch";

const template = (
  overrides: Partial<WhatsAppTemplateRow> = {},
): WhatsAppTemplateRow => ({
  id: "tpl-1",
  meta_id: "meta-1",
  name: "reapertura",
  language: "es",
  category: "MARKETING",
  status: "APPROVED",
  header_format: null,
  header_text: null,
  body: "Hola {{1}}, volvemos el {{2}}",
  footer_text: null,
  buttons: [],
  param_count: 2,
  example_params: ["Ana", "2 de diciembre"],
  rejection_reason: null,
  unsupported_reason: null,
  synced_at: null,
  created_by: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  ...overrides,
});

const SOURCES: WhatsAppParamSource[] = [
  { kind: "field", field: "first_name" },
  { kind: "static", value: "2 de diciembre" },
];

describe("whatsappTemplateEligibility", () => {
  test("an approved, supported template in the campaign language is sendable", () => {
    expect(whatsappTemplateEligibility(template(), "es", SOURCES)).toBeNull();
  });

  test("no template row at all", () => {
    expect(whatsappTemplateEligibility(null, "es", SOURCES)).toBe(
      "template_missing",
    );
    expect(whatsappTemplateEligibility(undefined, "es", SOURCES)).toBe(
      "template_missing",
    );
  });

  test.each(["draft", "PENDING", "REJECTED", "PAUSED", "DISABLED", "DELETED"])(
    "status %s is not approved",
    (status) => {
      expect(
        whatsappTemplateEligibility(
          template({ status: status as WhatsAppTemplateRow["status"] }),
          "es",
          SOURCES,
        ),
      ).toBe("template_not_approved");
    },
  );

  test("a template the dashboard cannot fill is unsupported", () => {
    expect(
      whatsappTemplateEligibility(
        template({ unsupported_reason: "media_header" }),
        "es",
        SOURCES,
      ),
    ).toBe("template_unsupported");
  });

  test("the template language must start with the campaign language", () => {
    expect(
      whatsappTemplateEligibility(template({ language: "en" }), "es", SOURCES),
    ).toBe("template_language");
    expect(
      whatsappTemplateEligibility(template({ language: "es" }), "en", SOURCES),
    ).toBe("template_language");
  });

  test("es_ES serves es and en_US serves en, whatever the casing", () => {
    expect(
      whatsappTemplateEligibility(
        template({ language: "es_ES" }),
        "es",
        SOURCES,
      ),
    ).toBeNull();
    expect(
      whatsappTemplateEligibility(
        template({ language: "en-US" }),
        "en",
        SOURCES,
      ),
    ).toBeNull();
    expect(
      whatsappTemplateEligibility(
        template({ language: "ES_es" }),
        "es",
        SOURCES,
      ),
    ).toBeNull();
  });

  test("a language that merely begins with the same letters does not count", () => {
    expect(
      whatsappTemplateEligibility(template({ language: "est" }), "es", SOURCES),
    ).toBe("template_language");
  });

  test("the sources must fill exactly the template's parameters", () => {
    expect(
      whatsappTemplateEligibility(template(), "es", SOURCES.slice(0, 1)),
    ).toBe("param_count");
    expect(
      whatsappTemplateEligibility(template({ param_count: 0 }), "es", SOURCES),
    ).toBe("param_count");
    expect(
      whatsappTemplateEligibility(template({ param_count: 0 }), "es", []),
    ).toBeNull();
  });

  test("reports the first problem in a fixed order", () => {
    expect(
      whatsappTemplateEligibility(
        template({
          status: "PAUSED",
          unsupported_reason: "named_params",
          language: "en",
        }),
        "es",
        [],
      ),
    ).toBe("template_not_approved");
  });
});

// ─── sendQueuedWhatsApp, against doubles ─────────────────────

type Update = { table: string; patch: Record<string, unknown>; id: string };

/** The slice of the Insforge client the sender uses, recording every write. */
function fakeDb(
  opts: {
    template?: WhatsAppTemplateRow | null;
    readError?: string;
    /** Fails every update of these row ids. */
    failUpdatesFor?: string[];
    onUpdate?: (update: Update) => void;
  } = {},
) {
  const updates: Update[] = [];
  const reads: string[] = [];
  const db = {
    from(table: string) {
      return {
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => {
              reads.push(`${table}:${id}`);
              if (opts.readError) {
                return { data: null, error: { message: opts.readError } };
              }
              return {
                data: "template" in opts ? opts.template : template(),
                error: null,
              };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_column: string, id: string) => {
            if (opts.failUpdatesFor?.includes(id)) {
              return { error: { message: "db down" } };
            }
            const update = { table, patch, id };
            updates.push(update);
            opts.onUpdate?.(update);
            return { error: null };
          },
        }),
      };
    },
  };
  return {
    db: db as unknown as NonNullable<WhatsAppDeps["db"]>,
    updates,
    reads,
  };
}

const campaign = (
  overrides: Partial<Pick<CampaignRow, "content" | "audience">> = {},
): CampaignRow =>
  ({
    id: "camp-1",
    channel: "whatsapp",
    audience: { language: "es", sendLocale: "es" },
    content: { whatsapp: { templateId: "tpl-1", params: SOURCES } },
    ...overrides,
  }) as unknown as CampaignRow;

const row = (n: number, overrides: Partial<QueuedRow> = {}): QueuedRow => ({
  id: `row-${n}`,
  contact_id: `contact-${n}`,
  email: null,
  phone: `+346000000${String(n).padStart(2, "0")}`,
  language: "es",
  variant: null,
  vars: null,
  contacts: {
    first_name: `Nombre${n}`,
    last_name: null,
    unsubscribe_token: null,
  },
  ...overrides,
});

const rowsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => row(i + 1));

/** A clock the test moves: `sleep` advances it, and so can a slow `send`. */
function fakeClock(start = 1_000_000) {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

const ok = (id: string): WhatsAppSendResult => ({
  status: "sent",
  providerId: id,
});

function fakeSend(
  answer: (send: TemplateSend, call: number) => WhatsAppSendResult,
  clock?: ReturnType<typeof fakeClock>,
  latencyMs = 0,
) {
  const calls: TemplateSend[] = [];
  const send = async (s: TemplateSend) => {
    calls.push(s);
    clock?.advance(latencyMs);
    return answer(s, calls.length);
  };
  return { send, calls };
}

describe("sendQueuedWhatsApp", () => {
  test("a success stamps the row sent with Meta's wamid and sends the template", async () => {
    const { db, updates } = fakeDb();
    const clock = fakeClock();
    const { send, calls } = fakeSend((_s, n) => ok(`wamid.${n}`), clock);

    const result = await sendQueuedWhatsApp(campaign(), rowsOf(2), {
      db,
      send,
      now: clock.now,
      sleep: clock.sleep,
    });

    expect(result).toEqual({
      sent: 2,
      failed: 0,
      lastError: null,
      remaining: 0,
    });
    expect(calls[0]).toEqual({
      to: "+34600000001",
      name: "reapertura",
      language: "es",
      bodyParams: ["Nombre1", "2 de diciembre"],
    });
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      table: "campaign_recipients",
      id: "row-1",
      patch: { status: "sent", provider_id: "wamid.1" },
    });
    expect(typeof updates[0].patch.sent_at).toBe("string");
  });

  test("parameters are resolved per recipient, from the row and its contact", async () => {
    const params: WhatsAppParamSource[] = [
      { kind: "field", field: "first_name" },
      { kind: "field", field: "last_name" },
      { kind: "field", field: "service" },
    ];
    const { db } = fakeDb({ template: template({ param_count: 3 }) });
    const { send, calls } = fakeSend(() => ok("w"));
    await sendQueuedWhatsApp(
      campaign({
        content: { whatsapp: { templateId: "tpl-1", params } },
      } as Partial<CampaignRow>),
      [
        row(1, {
          vars: { service: "Drenaje" },
          contacts: [
            { first_name: "Ana", last_name: "Pérez", unsubscribe_token: null },
          ],
        }),
        row(2, { contacts: null, vars: null }),
      ],
      { db, send },
    );
    expect(calls[0].bodyParams).toEqual(["Ana", "Pérez", "Drenaje"]);
    // A row without contact or vars still sends, with Meta's placeholder dash.
    expect(calls[1].bodyParams).toEqual(["—", "—", "—"]);
  });

  test("a refusal from Meta fails the row with Meta's text, unprefixed", async () => {
    const { db, updates } = fakeDb();
    const { send } = fakeSend(() => ({
      status: "failed",
      error: "Re-engagement message",
    }));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db,
      send,
    });
    expect(result).toEqual({
      sent: 0,
      failed: 1,
      lastError: "Re-engagement message",
      remaining: 0,
    });
    expect(updates[0].patch).toEqual({
      status: "failed",
      error: "Re-engagement message",
    });
  });

  test("a failure that may have been delivered is stamped [unconfirmed]", async () => {
    const { db, updates } = fakeDb();
    const { send } = fakeSend(() => ({
      status: "failed",
      error: "The operation timed out.",
      ambiguous: true,
    }));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db,
      send,
    });
    expect(updates[0].patch.status).toBe("failed");
    expect(updates[0].patch.error).toBe(
      `${UNCONFIRMED_PREFIX}The operation timed out.`,
    );
    expect(updates[0].patch.error).toStartWith("[unconfirmed] ");
    expect(result.failed).toBe(1);
  });

  test("a send that throws is treated as unconfirmed, not as a clean failure", async () => {
    const { db, updates } = fakeDb();
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db,
      send: async () => {
        throw new Error("boom");
      },
    });
    expect(updates[0].patch.error).toBe("[unconfirmed] boom");
    expect(result.failed).toBe(1);
  });

  test("without credentials nothing is sent and the rows stay queued", async () => {
    const { db, updates } = fakeDb();
    const { send, calls } = fakeSend(() => ({ status: "skipped" }));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(25), {
      db,
      send,
      sleep: async () => {},
    });
    expect(result).toEqual({
      sent: 0,
      failed: 0,
      lastError: "whatsapp_not_configured",
      remaining: 25,
    });
    // One batch found out; the other fifteen were never tried.
    expect(calls).toHaveLength(PER_SECOND);
    expect(updates).toHaveLength(0);
  });

  test("a row without a phone fails and never reaches Meta", async () => {
    const { db, updates } = fakeDb();
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(
      campaign(),
      [row(1, { phone: null }), row(2)],
      { db, send },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe("+34600000002");
    expect(result).toMatchObject({ sent: 1, failed: 1, remaining: 0 });
    expect(updates.find((u) => u.id === "row-1")?.patch).toEqual({
      status: "failed",
      error: "no phone",
    });
  });

  test.each([
    ["PENDING", "template_not_approved"],
    ["REJECTED", "template_not_approved"],
  ])(
    "an unapproved template (%s) sends nothing and leaves every row queued",
    async (status, code) => {
      const { db, updates } = fakeDb({
        template: template({ status: status as WhatsAppTemplateRow["status"] }),
      });
      const { send, calls } = fakeSend(() => ok("w"));
      const result = await sendQueuedWhatsApp(campaign(), rowsOf(3), {
        db,
        send,
      });
      expect(result).toEqual({
        sent: 0,
        failed: 0,
        lastError: `template_unavailable: ${code}`,
        remaining: 3,
      });
      expect(calls).toHaveLength(0);
      expect(updates).toHaveLength(0);
    },
  );

  test("a template that disappeared, or a campaign without one, sends nothing", async () => {
    for (const [dbOpts, camp] of [
      [{ template: null }, campaign()],
      [{}, campaign({ content: {} as CampaignRow["content"] })],
    ] as const) {
      const { db, updates } = fakeDb(dbOpts);
      const { send, calls } = fakeSend(() => ok("w"));
      const result = await sendQueuedWhatsApp(camp, rowsOf(2), { db, send });
      expect(result.lastError).toBe("template_unavailable: template_missing");
      expect(result.remaining).toBe(2);
      expect(calls).toHaveLength(0);
      expect(updates).toHaveLength(0);
    }
  });

  test("a parameter count that does not match the template sends nothing", async () => {
    const { db, updates } = fakeDb({ template: template({ param_count: 3 }) });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(2), {
      db,
      send,
    });
    expect(result).toEqual({
      sent: 0,
      failed: 0,
      lastError: "template_unavailable: param_count",
      remaining: 2,
    });
    expect(calls).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  test("a template in another language than the campaign sends nothing", async () => {
    const { db } = fakeDb({ template: template({ language: "en" }) });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db,
      send,
    });
    expect(result.lastError).toBe("template_unavailable: template_language");
    expect(calls).toHaveLength(0);
  });

  test("a failed template read is reported and sends nothing", async () => {
    const { db } = fakeDb({ readError: "timeout" });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(2), {
      db,
      send,
    });
    expect(result).toEqual({
      sent: 0,
      failed: 0,
      lastError: "db: timeout",
      remaining: 2,
    });
    expect(calls).toHaveLength(0);
  });

  test("the campaign's own locale picks the language to match", async () => {
    const { db } = fakeDb({ template: template({ language: "en_US" }) });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(
      campaign({
        audience: { language: "any", sendLocale: "en" },
      } as Partial<CampaignRow>),
      rowsOf(1),
      { db, send },
    );
    expect(result.sent).toBe(1);
    expect(calls[0].language).toBe("en_US");
  });

  test("each message is written the moment it is answered, not once per batch", async () => {
    // Row 2 is only answered after row 1 has been written. If the sender
    // waited for the whole batch before writing anything, neither would move.
    let openGate!: () => void;
    const gate = new Promise<void>((resolve) => (openGate = resolve));
    const { db, updates } = fakeDb({
      onUpdate: (update) => {
        if (update.id === "row-1") openGate();
      },
    });
    const send = async (s: TemplateSend) => {
      if (s.to.endsWith("02")) await gate;
      return ok("w");
    };
    const deadlock = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("updates waited for the batch")), 500),
    );
    const result = await Promise.race([
      sendQueuedWhatsApp(campaign(), rowsOf(2), { db, send }),
      deadlock,
    ]);
    expect(result.sent).toBe(2);
    expect(updates.map((u) => u.id)).toEqual(["row-1", "row-2"]);
  });

  test("a write that fails once is retried; a persistent failure still counts the send", async () => {
    let attempts = 0;
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: template(), error: null }),
          }),
        }),
        update: () => ({
          eq: async () => {
            attempts += 1;
            return { error: { message: "db down" } };
          },
        }),
      }),
    } as unknown as NonNullable<WhatsAppDeps["db"]>;
    const { send } = fakeSend(() => ok("w"));
    const original = console.error;
    console.error = () => {};
    try {
      const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
        db,
        send,
      });
      // Two attempts at the one row; the message did leave, so it counts.
      expect(attempts).toBe(2);
      expect(result.sent).toBe(1);
      expect(result.remaining).toBe(0);
    } finally {
      console.error = original;
    }
  });
});

describe("sendQueuedWhatsApp pacing and budget", () => {
  test("sends ten at a time and waits out the rest of each second", async () => {
    const { db } = fakeDb();
    const clock = fakeClock();
    const { send } = fakeSend(() => ok("w"), clock, 0);
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(25), {
      db,
      send,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(result).toMatchObject({ sent: 25, remaining: 0 });
    // Three batches (10, 10, 5): a pause after the first two, none after the last.
    expect(clock.sleeps).toEqual([1000, 1000]);
  });

  test("only the part of the second the batch did not use is waited", async () => {
    const { db } = fakeDb();
    const clock = fakeClock();
    // The ten sends of a batch run together: the first one's answer costs the
    // batch 400 ms of the clock, the rest are free.
    const { send } = fakeSend(() => ok("w"), undefined, 0);
    let calls = 0;
    const timed = async (s: TemplateSend) => {
      calls += 1;
      if (calls % PER_SECOND === 1) clock.advance(400);
      return send(s);
    };
    await sendQueuedWhatsApp(campaign(), rowsOf(25), {
      db,
      send: timed,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(clock.sleeps).toEqual([600, 600]);
  });

  test("a batch that already took a second is not followed by a pause", async () => {
    const { db } = fakeDb();
    const clock = fakeClock();
    let calls = 0;
    const slow = async () => {
      calls += 1;
      if (calls % PER_SECOND === 1) clock.advance(1200);
      return ok("w");
    };
    await sendQueuedWhatsApp(campaign(), rowsOf(25), {
      db,
      send: slow,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(clock.sleeps).toEqual([]);
  });

  test("a batch never holds more than ten messages in flight", async () => {
    const { db } = fakeDb();
    let inFlight = 0;
    let peak = 0;
    const send = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return ok("w");
    };
    await sendQueuedWhatsApp(campaign(), rowsOf(30), {
      db,
      send,
      sleep: async () => {},
    });
    expect(peak).toBe(PER_SECOND);
  });

  test("stops starting batches once the time budget is spent and reports what is left", async () => {
    const { db, updates } = fakeDb();
    const clock = fakeClock();
    const { send, calls } = fakeSend(() => ok("w"), clock, 0);
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(55), {
      db,
      send,
      now: clock.now,
      sleep: clock.sleep,
      budgetMs: 2500,
    });
    // t=0, t=1000, t=2000 start a batch; at t=3000 the budget is gone.
    expect(calls).toHaveLength(30);
    expect(result).toEqual({
      sent: 30,
      failed: 0,
      lastError: null,
      remaining: 25,
    });
    expect(updates).toHaveLength(30);
  });

  test("does not sleep towards a batch the budget will not let begin", async () => {
    const { db } = fakeDb();
    const clock = fakeClock();
    const { send, calls } = fakeSend(() => ok("w"), clock, 0);
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(30), {
      db,
      send,
      now: clock.now,
      sleep: clock.sleep,
      budgetMs: 1000,
    });
    expect(calls).toHaveLength(10);
    expect(clock.sleeps).toEqual([]);
    expect(result.remaining).toBe(20);
  });

  test("the default budget is inside the cron's 60 seconds", () => {
    expect(BUDGET_MS).toBeLessThan(60_000);
    expect(BUDGET_MS).toBeGreaterThanOrEqual(40_000);
  });

  test("nothing queued is a clean no-op that still loads no more than the template", async () => {
    const { db, updates, reads } = fakeDb();
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), [], { db, send });
    expect(result).toEqual({
      sent: 0,
      failed: 0,
      lastError: null,
      remaining: 0,
    });
    expect(calls).toHaveLength(0);
    expect(updates).toHaveLength(0);
    expect(reads).toEqual(["whatsapp_templates:tpl-1"]);
  });
});
