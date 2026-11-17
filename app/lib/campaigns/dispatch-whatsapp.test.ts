import { describe, expect, test } from "bun:test";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import type { CampaignRow } from "@/types/campaign";
import {
  PER_SECOND,
  SKIPPED_PREFIX,
  START_MARGIN_MS,
  UNCONFIRMED_PREFIX,
  consentVerdict,
  haltMessage,
  parseHalted,
  reconcileInterrupted,
  sendQueuedWhatsApp,
  whatsappTemplateEligibility,
} from "./dispatch-whatsapp";
import {
  SOURCES,
  campaign,
  consenting,
  fakeClock,
  fakeSend,
  memoryDb,
  ok,
  row,
  rowsOf,
  template,
} from "./whatsapp-fixtures";
import type { TemplateSend } from "@/lib/whatsapp/client";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";

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

const quietSleep = async () => {};

describe("sendQueuedWhatsApp", () => {
  test("a success stamps the row sent with Meta's wamid and sends the template", async () => {
    const mem = memoryDb(rowsOf(2));
    const clock = fakeClock();
    const { send, calls } = fakeSend((_s, n) => ok(`wamid.${n}`), clock);

    const result = await sendQueuedWhatsApp(campaign(), rowsOf(2), {
      db: mem.db,
      send,
      now: clock.now,
      sleep: clock.sleep,
    });

    expect(result).toMatchObject({
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
    expect(mem.status("row-1")).toBe("sent");
    expect(mem.rows.get("row-1")?.provider_id).toBe("wamid.1");
    expect(typeof mem.rows.get("row-1")?.sent_at).toBe("string");
  });

  test("parameters are resolved per recipient, from the row and its contact", async () => {
    const params: WhatsAppParamSource[] = [
      { kind: "field", field: "first_name" },
      { kind: "field", field: "last_name" },
      { kind: "field", field: "service" },
    ];
    const rows = [
      row(1, {
        vars: { service: "Drenaje" },
        contacts: [
          { first_name: "Ana", last_name: "Pérez", unsubscribe_token: null },
        ],
      }),
      row(2, { contacts: null, vars: null }),
    ];
    const mem = memoryDb(rows, { template: template({ param_count: 3 }) });
    const { send, calls } = fakeSend(() => ok("w"));
    await sendQueuedWhatsApp(
      campaign({
        content: { whatsapp: { templateId: "tpl-1", params } },
      } as Partial<CampaignRow>),
      rows,
      { db: mem.db, send },
    );
    expect(calls[0].bodyParams).toEqual(["Ana", "Pérez", "Drenaje"]);
    // A row without contact or vars still sends, with Meta's placeholder dash.
    expect(calls[1].bodyParams).toEqual(["—", "—", "—"]);
  });

  test("a refusal from Meta fails the row with Meta's text, unprefixed", async () => {
    const mem = memoryDb(rowsOf(1));
    const { send } = fakeSend(() => ({
      status: "failed",
      error: "Re-engagement message",
    }));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db: mem.db,
      send,
    });
    expect(result).toMatchObject({
      sent: 0,
      failed: 1,
      lastError: "Re-engagement message",
      remaining: 0,
    });
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("Re-engagement message");
  });

  test("a failure that may have been delivered is stamped [unconfirmed]", async () => {
    const mem = memoryDb(rowsOf(1));
    const { send } = fakeSend(() => ({
      status: "failed",
      error: "The operation timed out.",
      ambiguous: true,
    }));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db: mem.db,
      send,
    });
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe(
      `${UNCONFIRMED_PREFIX}The operation timed out.`,
    );
    expect(mem.error("row-1")).toStartWith("[unconfirmed] ");
    expect(result.failed).toBe(1);
  });

  test("Meta's error code leads the stored text", async () => {
    const mem = memoryDb(rowsOf(1));
    await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db: mem.db,
      send: fakeSend(() => ({
        status: "failed",
        error: "Message undeliverable",
        code: 131026,
      })).send,
    });
    expect(mem.error("row-1")).toBe("131026: Message undeliverable");
  });

  test("an ambiguous failure with a code keeps both, the prefix first", async () => {
    const mem = memoryDb(rowsOf(1));
    await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db: mem.db,
      send: fakeSend(() => ({
        status: "failed",
        error: "Service unavailable",
        code: 2,
        ambiguous: true,
      })).send,
    });
    expect(mem.error("row-1")).toBe("[unconfirmed] 2: Service unavailable");
  });

  test("a send that throws is treated as unconfirmed, not as a clean failure", async () => {
    const mem = memoryDb(rowsOf(1));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db: mem.db,
      send: async () => {
        throw new Error("boom");
      },
    });
    expect(mem.error("row-1")).toBe("[unconfirmed] boom");
    expect(result.failed).toBe(1);
  });

  test("without credentials nothing is sent and the rows stay queued", async () => {
    const mem = memoryDb(rowsOf(25));
    const { send, calls } = fakeSend(() => ({ status: "skipped" }));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(25), {
      db: mem.db,
      send,
      sleep: quietSleep,
    });
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      lastError: "whatsapp_not_configured",
      remaining: 25,
    });
    // One batch found out; the other fifteen were never tried.
    expect(calls).toHaveLength(PER_SECOND);
    expect([...mem.rows.values()].every((r) => r.status === "queued")).toBe(
      true,
    );
  });

  test("a row without a phone fails and never reaches Meta", async () => {
    const rows = [row(1, { phone: null }), row(2)];
    const mem = memoryDb(rows);
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rows, {
      db: mem.db,
      send,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe("+34600000002");
    expect(result).toMatchObject({ sent: 1, failed: 1, remaining: 0 });
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("no phone");
  });

  test.each(["PENDING", "REJECTED"])(
    "an unapproved template (%s) sends nothing and leaves every row queued",
    async (status) => {
      const mem = memoryDb(rowsOf(3), {
        template: template({ status: status as WhatsAppTemplateRow["status"] }),
      });
      const { send, calls } = fakeSend(() => ok("w"));
      const result = await sendQueuedWhatsApp(campaign(), rowsOf(3), {
        db: mem.db,
        send,
      });
      expect(result).toMatchObject({
        sent: 0,
        failed: 0,
        lastError: "template_unavailable: template_not_approved",
        remaining: 3,
      });
      expect(calls).toHaveLength(0);
      expect(mem.writes).toHaveLength(0);
    },
  );

  test("a template that disappeared, or a campaign without one, sends nothing", async () => {
    for (const [dbOpts, camp] of [
      [{ template: null }, campaign()],
      [{}, campaign({ content: {} as CampaignRow["content"] })],
    ] as const) {
      const mem = memoryDb(rowsOf(2), dbOpts);
      const { send, calls } = fakeSend(() => ok("w"));
      const result = await sendQueuedWhatsApp(camp, rowsOf(2), {
        db: mem.db,
        send,
      });
      expect(result.lastError).toBe("template_unavailable: template_missing");
      expect(result.remaining).toBe(2);
      expect(calls).toHaveLength(0);
      expect(mem.writes).toHaveLength(0);
    }
  });

  test("a parameter count that does not match the template sends nothing", async () => {
    const mem = memoryDb(rowsOf(2), { template: template({ param_count: 3 }) });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(2), {
      db: mem.db,
      send,
    });
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      lastError: "template_unavailable: param_count",
      remaining: 2,
    });
    expect(calls).toHaveLength(0);
    expect(mem.writes).toHaveLength(0);
  });

  test("a template in another language than the campaign sends nothing", async () => {
    const mem = memoryDb(rowsOf(1), { template: template({ language: "en" }) });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db: mem.db,
      send,
    });
    expect(result.lastError).toBe("template_unavailable: template_language");
    expect(calls).toHaveLength(0);
  });

  test("a failed template read is reported and sends nothing", async () => {
    const mem = memoryDb(rowsOf(2), { readError: "timeout" });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(2), {
      db: mem.db,
      send,
    });
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      lastError: "db: timeout",
      remaining: 2,
    });
    expect(calls).toHaveLength(0);
  });

  test("the campaign's own locale picks the language to match", async () => {
    const mem = memoryDb(rowsOf(1), {
      template: template({ language: "en_US" }),
    });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(
      campaign({
        audience: { language: "any", sendLocale: "en" },
      } as Partial<CampaignRow>),
      rowsOf(1),
      { db: mem.db, send },
    );
    expect(result.sent).toBe(1);
    expect(calls[0].language).toBe("en_US");
  });

  test("each message is written the moment it is answered, not once per batch", async () => {
    // Row 2 is only answered after row 1 has been written. If the sender
    // waited for the whole batch before writing anything, neither would move.
    let openGate!: () => void;
    const gate = new Promise<void>((resolve) => (openGate = resolve));
    const mem = memoryDb(rowsOf(2), {
      onWrite: (id, patch) => {
        if (id === "row-1" && patch.status === "sent") openGate();
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
      sendQueuedWhatsApp(campaign(), rowsOf(2), { db: mem.db, send }),
      deadlock,
    ]);
    expect(result.sent).toBe(2);
  });

  test("a throwing update does not abandon the rest of the batch", async () => {
    const mem = memoryDb(rowsOf(3), {
      failUpdate: ({ id }) => (id === "row-1" ? "throw" : null),
    });
    const { send, calls } = fakeSend(() => ok("w"));
    const original = console.error;
    console.error = () => {};
    try {
      await sendQueuedWhatsApp(campaign(), rowsOf(3), {
        db: mem.db,
        send,
        sleep: quietSleep,
      });
      expect(calls).toHaveLength(3);
      expect(mem.status("row-2")).toBe("sent");
      expect(mem.status("row-3")).toBe("sent");
    } finally {
      console.error = original;
    }
  });
});

describe("sendQueuedWhatsApp pacing and budget", () => {
  const run = (count: number, deps: Parameters<typeof sendQueuedWhatsApp>[2]) =>
    sendQueuedWhatsApp(campaign(), rowsOf(count), deps);

  test("sends ten at a time and waits out the rest of each second", async () => {
    const mem = memoryDb(rowsOf(25));
    const clock = fakeClock();
    const { send } = fakeSend(() => ok("w"), clock, 0);
    const result = await run(25, {
      db: mem.db,
      send,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(result).toMatchObject({ sent: 25, remaining: 0 });
    // Three batches (10, 10, 5): a pause after the first two, none after the last.
    expect(clock.sleeps).toEqual([1000, 1000]);
  });

  test("only the part of the second the batch did not use is waited", async () => {
    const mem = memoryDb(rowsOf(25));
    const clock = fakeClock();
    // The ten sends of a batch run together: the first one's answer costs the
    // batch 400 ms of the clock, the rest are free.
    let calls = 0;
    const timed = async () => {
      calls += 1;
      if (calls % PER_SECOND === 1) clock.advance(400);
      return ok("w");
    };
    await run(25, {
      db: mem.db,
      send: timed,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(clock.sleeps).toEqual([600, 600]);
  });

  test("a batch that already took a second is not followed by a pause", async () => {
    const mem = memoryDb(rowsOf(25));
    const clock = fakeClock();
    let calls = 0;
    const slow = async () => {
      calls += 1;
      if (calls % PER_SECOND === 1) clock.advance(1200);
      return ok("w");
    };
    await run(25, {
      db: mem.db,
      send: slow,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(clock.sleeps).toEqual([]);
  });

  test("a batch never holds more than ten messages in flight", async () => {
    const mem = memoryDb(rowsOf(30));
    let inFlight = 0;
    let peak = 0;
    const send = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return ok("w");
    };
    await run(30, { db: mem.db, send, sleep: quietSleep });
    expect(peak).toBe(PER_SECOND);
  });

  test("stops starting batches once the time budget is spent and reports what is left", async () => {
    const mem = memoryDb(rowsOf(55));
    const clock = fakeClock();
    const { send, calls } = fakeSend(() => ok("w"), clock, 0);
    const result = await run(55, {
      db: mem.db,
      send,
      now: clock.now,
      sleep: clock.sleep,
      budgetMs: 2500,
    });
    // t=0, t=1000, t=2000 start a batch; at t=3000 the budget is gone.
    expect(calls).toHaveLength(30);
    expect(result).toMatchObject({
      sent: 30,
      failed: 0,
      lastError: null,
      remaining: 25,
    });
  });

  test("does not sleep towards a batch the budget will not let begin", async () => {
    const mem = memoryDb(rowsOf(30));
    const clock = fakeClock();
    const { send, calls } = fakeSend(() => ok("w"), clock, 0);
    const result = await run(30, {
      db: mem.db,
      send,
      now: clock.now,
      sleep: clock.sleep,
      budgetMs: 1000,
    });
    expect(calls).toHaveLength(10);
    expect(clock.sleeps).toEqual([]);
    expect(result.remaining).toBe(20);
  });

  test("the default budget keeps a long send inside the cron's 60 seconds", async () => {
    // 2000 rows would take 200 s at ten a second: it must stop on its own.
    const mem = memoryDb(rowsOf(2000));
    const clock = fakeClock();
    const startedAt = clock.now();
    const { send } = fakeSend(() => ok("w"), clock, 0);
    const result = await run(2000, {
      db: mem.db,
      send,
      now: clock.now,
      sleep: clock.sleep,
    });
    const elapsed = clock.now() - startedAt;
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.sent).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(50_000);
    expect(elapsed).toBeGreaterThanOrEqual(40_000);
  });

  test("nothing queued is a clean no-op that loads no more than the template", async () => {
    const mem = memoryDb([]);
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), [], {
      db: mem.db,
      send,
    });
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      lastError: null,
      remaining: 0,
    });
    expect(calls).toHaveLength(0);
    expect(mem.writes).toHaveLength(0);
    expect(mem.reads).toEqual(["whatsapp_templates"]);
  });
});

describe("sendQueuedWhatsApp claims each row before sending to it", () => {
  test("a row is `sending` with claimed_at while its message is in flight", async () => {
    const mem = memoryDb(rowsOf(2));
    const seen: Record<string, unknown>[] = [];
    const send = async (s: TemplateSend) => {
      const id = s.to.endsWith("01") ? "row-1" : "row-2";
      seen.push({
        id,
        status: mem.status(id),
        claimed: typeof mem.rows.get(id)?.claimed_at,
      });
      return ok(`w-${id}`);
    };
    await sendQueuedWhatsApp(campaign(), rowsOf(2), { db: mem.db, send });
    expect(seen).toEqual([
      { id: "row-1", status: "sending", claimed: "string" },
      { id: "row-2", status: "sending", claimed: "string" },
    ]);
    expect(mem.status("row-1")).toBe("sent");
  });

  test("a row another process already holds is not sent and not counted", async () => {
    const mem = memoryDb(rowsOf(3), {
      rows: [{ id: "row-2", status: "sending" }],
    });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(3), {
      db: mem.db,
      send,
    });
    expect(calls.map((c) => c.to)).toEqual(["+34600000001", "+34600000003"]);
    expect(result).toMatchObject({ sent: 2, failed: 0, remaining: 0 });
    expect(mem.status("row-2")).toBe("sending");
  });

  test("a row that was already sent is not sent again", async () => {
    const mem = memoryDb(rowsOf(2), {
      rows: [{ id: "row-1", status: "sent" }],
    });
    const { send, calls } = fakeSend(() => ok("w"));
    await sendQueuedWhatsApp(campaign(), rowsOf(2), { db: mem.db, send });
    expect(calls).toHaveLength(1);
  });

  test("when the claim itself fails nothing is sent and the rows stay queued", async () => {
    const mem = memoryDb(rowsOf(12), {
      failUpdate: ({ patch }) =>
        patch.status === "sending" ? "db down" : null,
    });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(12), {
      db: mem.db,
      send,
      sleep: quietSleep,
    });
    expect(calls).toHaveLength(0);
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      lastError: "db: db down",
      remaining: 12,
    });
    expect([...mem.rows.values()].every((r) => r.status === "queued")).toBe(
      true,
    );
  });

  test("without credentials the claimed rows go back to queued", async () => {
    const mem = memoryDb(rowsOf(3));
    const { send } = fakeSend(() => ({ status: "skipped" }));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(3), {
      db: mem.db,
      send,
    });
    expect(result.remaining).toBe(3);
    for (const r of mem.rows.values()) {
      expect(r.status).toBe("queued");
      expect(r.claimed_at).toBeNull();
    }
  });
});

describe("sendQueuedWhatsApp when the final write fails", () => {
  const finalWrite = ({ patch }: { patch: Record<string, unknown> }) =>
    patch.status === "sent" || patch.status === "failed" ? "db down" : null;

  test("the row stays `sending`, never `queued`, and is counted as unrecorded", async () => {
    const mem = memoryDb(rowsOf(2), { failUpdate: finalWrite });
    const clock = fakeClock();
    const { send } = fakeSend(() => ok("w"));
    const original = console.error;
    console.error = () => {};
    try {
      const result = await sendQueuedWhatsApp(campaign(), rowsOf(2), {
        db: mem.db,
        send,
        now: clock.now,
        sleep: clock.sleep,
      });
      expect(result).toMatchObject({
        sent: 0,
        failed: 0,
        unrecorded: 2,
        remaining: 0,
      });
      for (const r of mem.rows.values()) expect(r.status).toBe("sending");
    } finally {
      console.error = original;
    }
  });

  test("a lost write does not become the campaign's last error", async () => {
    const mem = memoryDb(rowsOf(1), { failUpdate: finalWrite });
    const { send } = fakeSend(() => ok("w"));
    const original = console.error;
    console.error = () => {};
    try {
      const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
        db: mem.db,
        send,
        sleep: quietSleep,
      });
      expect(result.unrecorded).toBe(1);
      expect(result.lastError).toBeNull();
    } finally {
      console.error = original;
    }
  });

  test("it retries once after a short pause", async () => {
    const mem = memoryDb(rowsOf(1), {
      failUpdate: ({ patch, attempt }) =>
        patch.status === "sent" && attempt === 1 ? "blip" : null,
    });
    const clock = fakeClock();
    const { send } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db: mem.db,
      send,
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(result).toMatchObject({ sent: 1, unrecorded: 0 });
    expect(mem.status("row-1")).toBe("sent");
    expect(clock.sleeps).toContain(250);
  });

  test("a throwing write is handled the same way", async () => {
    const mem = memoryDb(rowsOf(1), {
      failUpdate: ({ patch }) => (patch.status === "sent" ? "throw" : null),
    });
    const { send } = fakeSend(() => ok("w"));
    const original = console.error;
    console.error = () => {};
    try {
      const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
        db: mem.db,
        send,
        sleep: quietSleep,
      });
      expect(result).toMatchObject({ sent: 0, unrecorded: 1 });
      expect(mem.status("row-1")).toBe("sending");
    } finally {
      console.error = original;
    }
  });

  test("a failed message whose write is lost is unrecorded too", async () => {
    const mem = memoryDb(rowsOf(1), { failUpdate: finalWrite });
    const { send } = fakeSend(() => ({ status: "failed", error: "nope" }));
    const original = console.error;
    console.error = () => {};
    try {
      const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
        db: mem.db,
        send,
        sleep: quietSleep,
      });
      expect(result).toMatchObject({ failed: 0, unrecorded: 1, remaining: 0 });
    } finally {
      console.error = original;
    }
  });

  test("a slow write is awaited before the send returns", async () => {
    const mem = memoryDb(rowsOf(3), { updateDelayMs: 30 });
    const { send } = fakeSend(() => ok("w"));
    await sendQueuedWhatsApp(campaign(), rowsOf(3), {
      db: mem.db,
      send,
      sleep: quietSleep,
    });
    // Were the writes fired and forgotten, these would still be `sending`.
    for (const r of mem.rows.values()) expect(r.status).toBe("sent");
  });
});

describe("reconcileInterrupted", () => {
  const NOW = Date.parse("2026-11-17T12:00:00Z");
  const iso = (minutesAgo: number) =>
    new Date(NOW - minutesAgo * 60_000).toISOString();

  test("fails rows left `sending` for more than five minutes, unconfirmed", async () => {
    const mem = memoryDb(rowsOf(4), {
      rows: [
        { id: "row-1", status: "sending", claimed_at: iso(6) },
        { id: "row-2", status: "sending", claimed_at: iso(4) },
        { id: "row-3", status: "sent", claimed_at: iso(60) },
      ],
    });
    const count = await reconcileInterrupted(mem.db, "camp-1", NOW);
    expect(count).toBe(1);
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("[unconfirmed] interrupted");
    expect(mem.status("row-2")).toBe("sending");
    expect(mem.status("row-3")).toBe("sent");
    expect(mem.status("row-4")).toBe("queued");
  });

  test("a failed read of the table is reported as zero, not thrown", async () => {
    const mem = memoryDb(rowsOf(1), { failUpdate: () => "down" });
    expect(await reconcileInterrupted(mem.db, "camp-1", NOW)).toBe(0);
  });
});

describe("consentVerdict", () => {
  const ok_ = consenting("c");
  test("a contact with marketing consent and no block may be messaged", () => {
    expect(consentVerdict(ok_)).toBeNull();
  });
  test("no contact at all", () => {
    expect(consentVerdict(undefined)).toBe("no_contact");
    expect(consentVerdict(null)).toBe("no_contact");
  });
  test("an opt-out wins over everything", () => {
    expect(
      consentVerdict({
        ...ok_,
        whatsapp_opted_out_at: "2026-11-02T00:00:00Z",
        whatsapp_unreachable_at: "2026-11-03T00:00:00Z",
        whatsapp_marketing_opted_in_at: null,
      }),
    ).toBe("opted_out");
  });
  test("an unreachable number comes before missing consent", () => {
    expect(
      consentVerdict({
        ...ok_,
        whatsapp_unreachable_at: "2026-11-03T00:00:00Z",
        whatsapp_marketing_opted_in_at: null,
      }),
    ).toBe("unreachable");
  });
  test("no marketing opt-in is no consent, whatever the booking-notice consent", () => {
    expect(
      consentVerdict({ ...ok_, whatsapp_marketing_opted_in_at: null }),
    ).toBe("no_consent");
  });
});

describe("sendQueuedWhatsApp does not write to a number that said STOP", () => {
  test("a suppressed number is skipped, whatever its contact's consent, and the rest are sent", async () => {
    const mem = memoryDb(rowsOf(3), { suppressed: ["+34600000002"] });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(3), {
      db: mem.db,
      send,
    });
    expect(calls.map((c) => c.to)).toEqual(["+34600000001", "+34600000003"]);
    expect(mem.status("row-2")).toBe("failed");
    expect(mem.error("row-2")).toBe(`${SKIPPED_PREFIX}suppressed`);
    expect(result).toMatchObject({ sent: 2, failed: 1, remaining: 0 });
  });

  test("the list is read for the numbers of the batch, once per batch", async () => {
    const mem = memoryDb(rowsOf(3));
    const { send } = fakeSend(() => ok("w"));
    await sendQueuedWhatsApp(campaign(), rowsOf(3), { db: mem.db, send });
    expect(mem.suppressedReads).toHaveLength(1);
    expect(mem.suppressedReads[0]).toEqual([
      "+34600000001",
      "+34600000002",
      "+34600000003",
    ]);
  });

  test("a list that cannot be read stops the send before anything is claimed or written: it fails closed", async () => {
    const mem = memoryDb(rowsOf(3), {
      suppressedError: 'relation "whatsapp_suppressed_phones" does not exist',
    });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(3), {
      db: mem.db,
      send,
    });
    expect(calls).toHaveLength(0);
    expect(mem.status("row-1")).toBe("queued");
    expect(mem.status("row-2")).toBe("queued");
    expect(result.sent).toBe(0);
    expect(result.remaining).toBe(3);
    expect(result.lastError).toContain("db:");
  });
});

describe("sendQueuedWhatsApp re-checks consent before every batch", () => {
  const blocked = (id: string, over: Record<string, string | null>) => ({
    ...consenting(id),
    ...over,
  });

  test("a contact who opted out after the audience was frozen gets nothing", async () => {
    const mem = memoryDb(rowsOf(3), {
      contacts: [
        consenting("contact-1"),
        blocked("contact-2", { whatsapp_opted_out_at: "2026-11-17T11:00:00Z" }),
        consenting("contact-3"),
      ],
    });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(3), {
      db: mem.db,
      send,
    });
    expect(calls.map((c) => c.to)).toEqual(["+34600000001", "+34600000003"]);
    expect(mem.status("row-2")).toBe("failed");
    expect(mem.error("row-2")).toBe(`${SKIPPED_PREFIX}opted_out`);
    expect(result).toMatchObject({ sent: 2, failed: 1, remaining: 0 });
  });

  test("an unreachable number, a missing marketing consent and a deleted contact are skipped", async () => {
    // A deleted contact has had its contact_id nulled by the foreign key.
    const rows = [row(1), row(2), row(3, { contact_id: null })];
    const mem = memoryDb(rows, {
      contacts: [
        blocked("contact-1", {
          whatsapp_unreachable_at: "2026-11-10T00:00:00Z",
        }),
        blocked("contact-2", { whatsapp_marketing_opted_in_at: null }),
      ],
    });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rows, {
      db: mem.db,
      send,
    });
    expect(calls).toHaveLength(0);
    expect(mem.error("row-1")).toBe("[skipped] unreachable");
    expect(mem.error("row-2")).toBe("[skipped] no_consent");
    expect(mem.error("row-3")).toBe("[skipped] no_contact");
    expect(result).toMatchObject({ sent: 0, failed: 3, remaining: 0 });
  });

  test("a contact the read did not return is left queued for the next tick, not skipped", async () => {
    // contact-2 is missing from the answer: a failed read or a delete racing
    // it. Nothing irreversible is written for it.
    const mem = memoryDb(rowsOf(3), {
      contacts: [consenting("contact-1"), consenting("contact-3")],
    });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(3), {
      db: mem.db,
      send,
    });
    expect(calls.map((c) => c.to)).toEqual(["+34600000001", "+34600000003"]);
    expect(mem.status("row-2")).toBe("queued");
    expect(mem.rows.get("row-2")?.claimed_at).toBeNull();
    expect(result).toMatchObject({ sent: 2, failed: 0, remaining: 1 });
  });

  test("an empty answer without an error leaves the whole batch queued", async () => {
    const mem = memoryDb(rowsOf(12), { contacts: [] });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(12), {
      db: mem.db,
      send,
      sleep: quietSleep,
    });
    expect(calls).toHaveLength(0);
    expect(result).toMatchObject({ sent: 0, failed: 0, remaining: 12 });
    expect([...mem.rows.values()].every((r) => r.status === "queued")).toBe(
      true,
    );
  });

  test("one contacts query per batch, for that batch's contacts only", async () => {
    const mem = memoryDb(rowsOf(25));
    const { send } = fakeSend(() => ok("w"));
    await sendQueuedWhatsApp(campaign(), rowsOf(25), {
      db: mem.db,
      send,
      sleep: quietSleep,
    });
    expect(mem.contactReads).toHaveLength(3);
    expect(mem.contactReads.map((ids) => ids.length)).toEqual([10, 10, 5]);
    expect(mem.contactReads[1][0]).toBe("contact-11");
  });

  test("a consent that changes between batches is seen by the next one", async () => {
    const mem = memoryDb(rowsOf(15), {
      onWrite: (id, patch) => {
        // Contact 12 says STOP while the first batch is going out.
        if (id === "row-1" && patch.status === "sent") {
          mem.contacts.set("contact-12", {
            ...consenting("contact-12"),
            whatsapp_opted_out_at: "2026-11-17T11:30:00Z",
          });
        }
      },
    });
    const { send, calls } = fakeSend(() => ok("w"));
    await sendQueuedWhatsApp(campaign(), rowsOf(15), {
      db: mem.db,
      send,
      sleep: quietSleep,
    });
    expect(calls.map((c) => c.to)).not.toContain("+34600000012");
    expect(mem.error("row-12")).toBe("[skipped] opted_out");
    expect(calls).toHaveLength(14);
  });

  test("when the consent read fails the batch is not sent and the rows stay queued", async () => {
    const mem = memoryDb(rowsOf(12), { contactsError: "timeout" });
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(12), {
      db: mem.db,
      send,
      sleep: quietSleep,
    });
    expect(calls).toHaveLength(0);
    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      lastError: "db: timeout",
      remaining: 12,
    });
    expect([...mem.rows.values()].every((r) => r.status === "queued")).toBe(
      true,
    );
  });

  test("a skipped contact does not become the campaign's last error", async () => {
    const mem = memoryDb(rowsOf(1), {
      contacts: [blocked("contact-1", { whatsapp_opted_out_at: "x" })],
    });
    const result = await sendQueuedWhatsApp(campaign(), rowsOf(1), {
      db: mem.db,
      send: fakeSend(() => ok("w")).send,
    });
    expect(result.failed).toBe(1);
    expect(result.lastError).toBeNull();
  });
});

describe("sendQueuedWhatsApp stops after repeated refusals", () => {
  const refuse = (error = "Template param mismatch", code = 132000) => ({
    status: "failed" as const,
    error,
    code,
  });
  const run = (count: number, send: ReturnType<typeof fakeSend>["send"]) => {
    const mem = memoryDb(rowsOf(count));
    return {
      mem,
      done: sendQueuedWhatsApp(campaign(), rowsOf(count), {
        db: mem.db,
        send,
        sleep: quietSleep,
      }),
    };
  };

  test("three batches in a row that Meta refuses for the same reason end the run", async () => {
    const { send, calls } = fakeSend(() => refuse());
    const { mem, done } = run(45, send);
    const result = await done;
    expect(calls).toHaveLength(30);
    expect(result).toMatchObject({
      sent: 0,
      failed: 30,
      remaining: 15,
      halted: "132000: Template param mismatch",
    });
    // The rest was never touched.
    expect(mem.status("row-31")).toBe("queued");
    expect(mem.status("row-45")).toBe("queued");
  });

  test("two refused batches and then a good one do not end it", async () => {
    const { send, calls } = fakeSend((_s, n) => (n <= 20 ? refuse() : ok("w")));
    const { done } = run(45, send);
    const result = await done;
    expect(calls).toHaveLength(45);
    expect(result).toMatchObject({ failed: 20, sent: 25, halted: null });
  });

  test("a single success inside a refused batch resets the count", async () => {
    // Batches 1 and 3 fail whole; batch 2 has one good message.
    const { send, calls } = fakeSend((_s, n) =>
      n === 15 ? ok("w") : n <= 40 ? refuse() : ok("w"),
    );
    const { done } = run(50, send);
    const result = await done;
    expect(calls).toHaveLength(50);
    expect(result.halted).toBeNull();
  });

  test("refusals for different reasons do not add up", async () => {
    const { send, calls } = fakeSend((_s, n) =>
      refuse(`reason ${n}`, 130000 + n),
    );
    const { done } = run(40, send);
    const result = await done;
    expect(calls).toHaveLength(40);
    expect(result).toMatchObject({ failed: 40, halted: null });
  });

  test("a different reason in the third batch restarts the count", async () => {
    const { send, calls } = fakeSend((_s, n) =>
      n <= 20 ? refuse() : refuse("Another thing", 131000),
    );
    const { done } = run(50, send);
    const result = await done;
    // Batches 3, 4, 5 share the new reason: halted after batch 5.
    expect(calls).toHaveLength(50);
    expect(result.halted).toBe("131000: Another thing");
  });

  test("ambiguous failures never count: they say nothing about the cause", async () => {
    const { send, calls } = fakeSend(() => ({
      status: "failed",
      error: "The operation timed out.",
      ambiguous: true,
    }));
    const { done } = run(40, send);
    const result = await done;
    expect(calls).toHaveLength(40);
    expect(result.halted).toBeNull();
  });

  test("skipped contacts and rows without a phone never count either", async () => {
    const rows = rowsOf(40).map((r) => ({ ...r, phone: null }));
    const mem = memoryDb(rows);
    const { send, calls } = fakeSend(() => ok("w"));
    const result = await sendQueuedWhatsApp(campaign(), rows, {
      db: mem.db,
      send,
      sleep: quietSleep,
    });
    expect(calls).toHaveLength(0);
    expect(result).toMatchObject({ failed: 40, halted: null, remaining: 0 });
  });

  test("the message the campaign records is a stable prefix and Meta's text", () => {
    expect(haltMessage("132000: Template param mismatch")).toBe(
      "[halted] 132000: Template param mismatch",
    );
  });

  test("parseHalted gives the reason back, and only for a halted message", () => {
    expect(parseHalted(haltMessage("132000: Template param mismatch"))).toBe(
      "132000: Template param mismatch",
    );
    expect(parseHalted("[halted] ")).toBe("");
    expect(parseHalted("template_unavailable: param_count")).toBeNull();
    expect(parseHalted("Template param mismatch [halted] ")).toBeNull();
    expect(parseHalted(null)).toBeNull();
    expect(parseHalted(undefined)).toBeNull();
  });
});

describe("sendQueuedWhatsApp and a deadline shared with other work", () => {
  const T0 = 1_000_000;
  const run = (
    count: number,
    clock: ReturnType<typeof fakeClock>,
    deadlineAt: number | undefined,
    startedSends?: number[],
  ) => {
    const mem = memoryDb(rowsOf(count));
    const send = async () => {
      startedSends?.push(clock.now());
      return ok("w");
    };
    return sendQueuedWhatsApp(campaign(), rowsOf(count), {
      db: mem.db,
      send,
      now: clock.now,
      sleep: clock.sleep,
      deadlineAt,
    });
  };

  test("no batch starts when less than the safety margin is left", async () => {
    const clock = fakeClock(T0);
    const result = await run(30, clock, T0 + START_MARGIN_MS - 1);
    expect(result).toMatchObject({ sent: 0, remaining: 30 });
  });

  test("a batch may start exactly at the margin", async () => {
    const clock = fakeClock(T0);
    const result = await run(30, clock, T0 + START_MARGIN_MS);
    expect(result.sent).toBe(10);
  });

  test("it works up to the deadline, not up to its own budget", async () => {
    const clock = fakeClock(T0);
    // Batches begin at +0, +1 s, +2 s; at +3 s only 4.5 s would be left.
    const result = await run(100, clock, T0 + 7500);
    expect(result).toMatchObject({ sent: 30, remaining: 70 });
  });

  test("the budget is the smaller of 45 s and what the deadline leaves", async () => {
    const far = fakeClock(T0);
    const farResult = await run(1000, far, T0 + 10 * 60_000);
    expect(far.now() - T0).toBeLessThan(46_000);
    expect(farResult.remaining).toBeGreaterThan(0);

    const near = fakeClock(T0);
    await run(1000, near, T0 + 20_000);
    expect(near.now() - T0).toBeLessThanOrEqual(20_000);
  });

  test("the margin leaves room for a batch that waits on a slow Meta", () => {
    // A batch may wait 10 s for Meta and then write its rows.
    expect(START_MARGIN_MS).toBeGreaterThanOrEqual(5000);
  });

  test("two sends in one invocation never start a message past the deadline", async () => {
    const clock = fakeClock(T0);
    const deadlineAt = T0 + 50_000;
    const started: number[] = [];
    const first = await run(1000, clock, deadlineAt, started);
    const second = await run(1000, clock, deadlineAt, started);
    expect(first.sent).toBeGreaterThan(0);
    // The first took the whole 45 s budget; the second got what was left.
    expect(second.sent).toBeLessThan(first.sent);
    expect(Math.max(...started)).toBeLessThanOrEqual(
      deadlineAt - START_MARGIN_MS,
    );
    expect(clock.now()).toBeLessThanOrEqual(deadlineAt);
    expect(second.remaining).toBeGreaterThan(0);
  });

  test("a send that begins after the deadline sends nothing at all", async () => {
    const clock = fakeClock(T0 + 60_000);
    const result = await run(20, clock, T0 + 50_000);
    expect(result).toMatchObject({ sent: 0, remaining: 20 });
  });
});
