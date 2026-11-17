import { describe, expect, test } from "bun:test";
import type { CampaignRow } from "@/types/campaign";
import type { Recipient } from "./audience-filter";
import {
  abandonedMessage,
  dispatchCampaign,
  reconcileAllInterrupted,
  retryFailed,
} from "./dispatch";
import { RETRYABLE_FAILURE_FILTER } from "./dispatch-whatsapp";
import { INTERRUPTED_ERROR } from "./dispatch-whatsapp";
import {
  campaign,
  fakeClock,
  fakeSend,
  memoryDb,
  ok,
  rowsOf,
  template,
  type MemoryDbOptions,
} from "./whatsapp-fixtures";
import { argsOf, has } from "./fake-db";

const recipient = (n: number): Recipient => ({
  id: `contact-${n}`,
  email: null,
  firstName: `Nombre${n}`,
  language: "en",
  phone: `+346000000${String(n).padStart(2, "0")}`,
});

/** A WhatsApp dispatch over an in-memory database and a fake sender. */
function setup(
  count: number,
  opts: MemoryDbOptions & {
    configured?: boolean;
    send?: Parameters<typeof fakeSend>[0];
    budgetMs?: number;
    latencyMs?: number;
  } = {},
) {
  const queued = rowsOf(count);
  const mem = memoryDb(queued, {
    campaign: campaign({ status: "draft" }),
    ...opts,
  });
  const clock = fakeClock();
  const sender = fakeSend(opts.send ?? (() => ok("w")), clock, opts.latencyMs);
  const deps = {
    db: mem.db,
    resolveAudience: async () =>
      Array.from({ length: count }, (_, i) => recipient(i + 1)),
    isWhatsAppConfigured: () => opts.configured ?? true,
    whatsapp: {
      send: sender.send,
      now: clock.now,
      sleep: clock.sleep,
      budgetMs: opts.budgetMs,
    },
  };
  return { mem, deps, sender, clock };
}

const touchedCampaign = (log: ReturnType<typeof memoryDb>["log"]) =>
  log.filter((q) => q.table === "campaigns" && has(q.chain, "update"));

describe("dispatchCampaign: the checks come before the claim", () => {
  test("without WhatsApp credentials the campaign is left exactly as it was", async () => {
    const { mem, deps, sender } = setup(3, { configured: false });
    const result = await dispatchCampaign("camp-1", {}, deps);
    expect(result).toEqual({ ok: false, error: "whatsapp_not_configured" });
    expect(mem.campaign.status).toBe("draft");
    expect(touchedCampaign(mem.log)).toHaveLength(0);
    expect(mem.upserts).toHaveLength(0);
    expect(sender.calls).toHaveLength(0);
  });

  test.each([
    ["PENDING", "template_not_approved"],
    ["PAUSED", "template_not_approved"],
  ])(
    "a %s template stops it with %s and changes nothing",
    async (status, detail) => {
      const { mem, deps, sender } = setup(3, {
        template: template({ status: status as "PENDING" }),
      });
      const result = await dispatchCampaign("camp-1", {}, deps);
      expect(result).toEqual({
        ok: false,
        error: "template_unavailable",
        detail,
      });
      expect(mem.campaign.status).toBe("draft");
      expect(touchedCampaign(mem.log)).toHaveLength(0);
      expect(sender.calls).toHaveLength(0);
    },
  );

  test("a template with the wrong number of parameters stops it too", async () => {
    const { mem, deps } = setup(1, { template: template({ param_count: 5 }) });
    const result = await dispatchCampaign("camp-1", {}, deps);
    expect(result).toMatchObject({
      error: "template_unavailable",
      detail: "param_count",
    });
    expect(touchedCampaign(mem.log)).toHaveLength(0);
  });

  test("an email campaign does not care about WhatsApp and goes on to claim", async () => {
    const { mem, deps } = setup(1, {
      configured: false,
      campaign: campaign({ channel: "email", status: "sent" }),
    });
    const result = await dispatchCampaign("camp-1", {}, deps);
    // It was claimed (and refused: it is already sent), which is past the checks.
    expect(result).toEqual({ ok: false, error: "not_claimable" });
    expect(touchedCampaign(mem.log).length).toBeGreaterThan(0);
  });

  test("a campaign that does not exist is not claimable", async () => {
    const { deps, mem } = setup(1);
    mem.campaign.id = "someone-else";
    const result = await dispatchCampaign(
      "camp-1",
      {},
      {
        ...deps,
        db: memoryDb([], { campaign: campaign({ status: "sent" }) }).db,
      },
    );
    expect(result).toEqual({ ok: false, error: "not_claimable" });
  });
});

describe("dispatchCampaign: a blocked campaign says why", () => {
  test("a scheduled campaign blocked by missing credentials keeps its state and shows the reason", async () => {
    const { mem, deps } = setup(1, {
      configured: false,
      campaign: campaign({ status: "scheduled" }),
    });
    await dispatchCampaign("camp-1", {}, deps);
    expect(mem.campaign.status).toBe("scheduled");
    expect(mem.campaign.last_error).toBe("whatsapp_not_configured");
  });

  test("a stuck send blocked by its template shows the reason too", async () => {
    const { mem, deps } = setup(1, {
      campaign: campaign({
        status: "sending",
        sending_started_at: "2026-01-01T00:00:00Z",
      }),
      template: template({ status: "PAUSED" }),
    });
    await dispatchCampaign("camp-1", { resume: true }, deps);
    expect(mem.campaign.status).toBe("sending");
    expect(mem.campaign.last_error).toBe(
      "template_unavailable: template_not_approved",
    );
  });

  test("a draft is not written to: the action already answers the admin", async () => {
    const { mem, deps } = setup(1, { configured: false });
    await dispatchCampaign("camp-1", {}, deps);
    expect(mem.campaign.last_error ?? null).toBeNull();
  });
});

describe("abandonedMessage", () => {
  test("the usual one", () => {
    expect(abandonedMessage(null)).toBe("abandoned after two hours in sending");
    expect(abandonedMessage("some error")).toBe(
      "abandoned after two hours in sending",
    );
  });

  test("names the template when that is what held the queue", () => {
    expect(
      abandonedMessage("template_unavailable: template_not_approved"),
    ).toBe(
      "abandoned after two hours: the WhatsApp template could not be sent (template_unavailable: template_not_approved)",
    );
  });

  test("names missing credentials", () => {
    expect(abandonedMessage("whatsapp_not_configured")).toBe(
      "abandoned after two hours: WhatsApp is not configured on the server",
    );
  });
});

describe("dispatchCampaign: a WhatsApp send", () => {
  test("freezes the audience as WhatsApp rows and marks the campaign sent", async () => {
    const { mem, deps, sender } = setup(3);
    const result = await dispatchCampaign("camp-1", {}, deps);

    expect(result).toMatchObject({ ok: true, sent: 3, failed: 0 });
    const [{ rows, options }] = mem.upserts;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      campaign_id: "camp-1",
      contact_id: "contact-1",
      email: null,
      phone: "+34600000001",
      // The campaign's language (es), not the recipient's (en).
      language: "es",
      status: "queued",
      cycle: "",
      variant: null,
    });
    expect(options).toEqual({
      onConflict: "campaign_id,phone,cycle",
      ignoreDuplicates: true,
    });
    expect(sender.calls).toHaveLength(3);
    expect(mem.campaign.status).toBe("sent");
    expect(typeof mem.campaign.sent_at).toBe("string");
  });

  test("a campaign that ran out of time is not marked sent and keeps its queue", async () => {
    // Ten a batch; every send costs the clock 5 s against a 3 s budget.
    const { mem, deps, sender } = setup(25, {
      budgetMs: 3000,
      latencyMs: 5000,
    });
    const result = await dispatchCampaign("camp-1", {}, deps);

    expect(result).toMatchObject({
      ok: true,
      sent: 10,
      failed: 0,
      remaining: 15,
    });
    expect(sender.calls).toHaveLength(10);
    // Still `sending`: that is what lets the cron resume it.
    expect(mem.campaign.status).toBe("sending");
    expect(mem.campaign.sent_at ?? null).toBeNull();
    const queuedLeft = [...mem.rows.values()].filter(
      (r) => r.status === "queued",
    );
    expect(queuedLeft).toHaveLength(15);
  });

  test("a row without a phone fails, is counted, and the campaign still finishes", async () => {
    const rows = rowsOf(2);
    rows[0] = { ...rows[0], phone: null };
    const mem = memoryDb(rows, { campaign: campaign({ status: "draft" }) });
    const sender = fakeSend(() => ok("w"));
    const result = await dispatchCampaign(
      "camp-1",
      {},
      {
        db: mem.db,
        resolveAudience: async () => [recipient(1), recipient(2)],
        isWhatsAppConfigured: () => true,
        whatsapp: { send: sender.send, sleep: async () => {} },
      },
    );
    expect(result).toMatchObject({ ok: true, sent: 1, failed: 1 });
    expect(mem.error("row-1")).toBe("no phone");
    expect(mem.campaign.status).toBe("sent");
    expect(mem.campaign.failed_count).toBe(1);
  });

  test("an empty audience fails the campaign without sending", async () => {
    const { mem, deps, sender } = setup(1);
    const result = await dispatchCampaign(
      "camp-1",
      {},
      {
        ...deps,
        resolveAudience: async () => [],
      },
    );
    expect(result).toEqual({ ok: false, error: "empty_audience" });
    expect(mem.campaign.status).toBe("failed");
    expect(sender.calls).toHaveLength(0);
  });
});

describe("dispatchCampaign: resuming", () => {
  const stuck = (): Partial<CampaignRow> => ({
    status: "sending",
    sending_started_at: "2026-01-01T00:00:00Z",
  });

  test("sends only the rows still queued and does not freeze the audience again", async () => {
    const { mem, deps, sender } = setup(3, {
      campaign: campaign(stuck()),
      rows: [{ id: "row-1", status: "sent" }],
    });
    const result = await dispatchCampaign("camp-1", { resume: true }, deps);
    expect(result).toMatchObject({ ok: true, sent: 2 });
    expect(sender.calls).toHaveLength(2);
    expect(mem.upserts).toHaveLength(0);
  });

  test("fails what a dead process left `sending`, unconfirmed, and counts it", async () => {
    const { mem, deps, sender } = setup(2, {
      campaign: campaign(stuck()),
      rows: [
        {
          id: "row-1",
          status: "sending",
          claimed_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const result = await dispatchCampaign("camp-1", { resume: true }, deps);
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe(INTERRUPTED_ERROR);
    // Never sent again: only the other row went out.
    expect(sender.calls.map((c) => c.to)).toEqual(["+34600000002"]);
    expect(result).toMatchObject({ ok: true, sent: 1 });
    expect(mem.campaign.failed_count).toBe(1);
  });

  test("a campaign that is not actually stuck is not claimable on resume", async () => {
    const { deps } = setup(1, {
      campaign: campaign({
        status: "sending",
        sending_started_at: new Date().toISOString(),
      }),
    });
    const result = await dispatchCampaign("camp-1", { resume: true }, deps);
    expect(result).toEqual({ ok: false, error: "not_claimable" });
  });
});

describe("dispatchCampaign: a deadline from its caller", () => {
  test("a deadline already close leaves the campaign sending with its queue intact", async () => {
    const { mem, deps, clock, sender } = setup(25);
    const result = await dispatchCampaign(
      "camp-1",
      { deadlineAt: clock.now() + 1000 },
      deps,
    );
    expect(sender.calls).toHaveLength(0);
    expect(result).toMatchObject({ ok: true, sent: 0, remaining: 25 });
    expect(mem.campaign.status).toBe("sending");
  });

  test("with room it sends and finishes as before", async () => {
    const { mem, deps, clock } = setup(3);
    const result = await dispatchCampaign(
      "camp-1",
      { deadlineAt: clock.now() + 50_000 },
      deps,
    );
    expect(result).toMatchObject({ ok: true, sent: 3 });
    expect(mem.campaign.status).toBe("sent");
  });
});

describe("dispatchCampaign: repeated refusals", () => {
  const refuse = () => ({
    status: "failed" as const,
    error: "Template param mismatch",
    code: 132000,
  });

  test("a one-off campaign Meta keeps refusing is marked failed and keeps its queue", async () => {
    const { mem, deps } = setup(45, { send: refuse });
    const result = await dispatchCampaign("camp-1", {}, deps);
    expect(result).toMatchObject({
      ok: true,
      sent: 0,
      failed: 30,
      remaining: 15,
    });
    expect(mem.campaign.status).toBe("failed");
    expect(mem.campaign.last_error).toBe(
      "[halted] 132000: Template param mismatch",
    );
    expect(mem.campaign.sent_at ?? null).toBeNull();
    expect(
      [...mem.rows.values()].filter((r) => r.status === "queued"),
    ).toHaveLength(15);
  });
});

describe("a lost write is reported on the campaign", () => {
  test("the campaign finishes and says how many went out unrecorded", async () => {
    const { mem, deps } = setup(2, {
      failUpdate: ({ patch }) => (patch.status === "sent" ? "db down" : null),
    });
    const original = console.error;
    console.error = () => {};
    try {
      const result = await dispatchCampaign("camp-1", {}, deps);
      expect(result).toMatchObject({ ok: true, sent: 0, unrecorded: 2 });
      expect(mem.campaign.status).toBe("sent");
      expect(mem.campaign.last_error).toBe("2 sent without being recorded");
    } finally {
      console.error = original;
    }
  });
});

describe("reconcileAllInterrupted", () => {
  const NOW = Date.parse("2026-11-17T12:00:00Z");
  const iso = (minutesAgo: number) =>
    new Date(NOW - minutesAgo * 60_000).toISOString();

  test("settles a closed campaign's orphaned rows and recounts it", async () => {
    // The campaign finished as `sent` long ago; nothing will resume it.
    const mem = memoryDb(rowsOf(3), {
      campaign: campaign({ status: "sent" }),
      rows: [
        { id: "row-1", status: "sending", claimed_at: iso(6) },
        { id: "row-2", status: "sending", claimed_at: iso(2) },
        { id: "row-3", status: "sent" },
      ],
    });
    const touched = await reconcileAllInterrupted(NOW, mem.db);
    expect(touched).toEqual(["camp-1"]);
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("[unconfirmed] interrupted");
    expect(mem.status("row-2")).toBe("sending");
    expect(mem.campaign.failed_count).toBe(1);
  });

  test("is one UPDATE for every campaign, with no campaign filter", async () => {
    const mem = memoryDb(rowsOf(1), {
      rows: [{ id: "row-1", status: "sending", claimed_at: iso(30) }],
    });
    await reconcileAllInterrupted(NOW, mem.db);
    const updates = mem.log.filter(
      (q) => q.table === "campaign_recipients" && has(q.chain, "update"),
    );
    expect(updates).toHaveLength(1);
    expect(
      updates[0].chain.some(
        (step) => step.name === "eq" && step.args[0] === "campaign_id",
      ),
    ).toBe(false);
  });

  test("recounts only the campaigns that had orphans, and nothing when none", async () => {
    const mem = memoryDb(rowsOf(2), {
      campaign: campaign({ status: "sent" }),
      rows: [{ id: "row-1", status: "sending", claimed_at: iso(1) }],
    });
    expect(await reconcileAllInterrupted(NOW, mem.db)).toEqual([]);
    expect(touchedCampaign(mem.log)).toHaveLength(0);
  });

  test("a failed UPDATE is an error for the caller to log, not a silent zero", async () => {
    const mem = memoryDb(rowsOf(1), { failUpdate: () => "db down" });
    await expect(reconcileAllInterrupted(NOW, mem.db)).rejects.toThrow(
      "db down",
    );
  });
});

describe("retryFailed", () => {
  test("checks the template before reopening anything", async () => {
    const { mem, deps } = setup(1, {
      campaign: campaign({ status: "sent" }),
      template: template({ status: "REJECTED" }),
    });
    const result = await retryFailed("camp-1", {}, deps);
    expect(result).toMatchObject({ ok: false, error: "template_unavailable" });
    expect(mem.campaign.status).toBe("sent");
    expect(touchedCampaign(mem.log)).toHaveLength(0);
  });

  test("a WhatsApp campaign that stopped on repeated refusals is retried: queue and failures", async () => {
    const { mem, deps, sender } = setup(12, {
      campaign: campaign({ status: "failed" }),
      rows: Array.from({ length: 10 }, (_, i) => ({
        id: `row-${i + 1}`,
        status: "failed",
        error: "132000: Template param mismatch",
      })),
    });
    const result = await retryFailed("camp-1", {}, deps);
    // The ten requeued failures and the two rows that never left the queue.
    expect(sender.calls).toHaveLength(12);
    expect(result).toMatchObject({ ok: true, sent: 12 });
    expect(mem.campaign.status).toBe("sent");
  });

  test("an email campaign marked failed is still not retried", async () => {
    const { deps } = setup(1, {
      campaign: campaign({ channel: "email", status: "failed" }),
    });
    expect(await retryFailed("camp-1", {}, deps)).toEqual({
      ok: false,
      error: "not_claimable",
    });
  });

  test("a campaign that is not finished cannot be retried", async () => {
    const { deps } = setup(1, { campaign: campaign({ status: "sending" }) });
    expect(await retryFailed("camp-1", {}, deps)).toEqual({
      ok: false,
      error: "not_claimable",
    });
  });

  test("a WhatsApp retry reads the retryable failures, then requeues them by id", async () => {
    const { mem, deps, sender } = setup(2, {
      campaign: campaign({ status: "sent" }),
      rows: [{ id: "row-1", status: "failed", error: "Meta said no" }],
    });
    const result = await retryFailed("camp-1", {}, deps);
    expect(result).toMatchObject({ ok: true, sent: 2 });
    expect(sender.calls).toHaveLength(2);
    expect(mem.campaign.status).toBe("sent");

    // The filter travels on a read: PostgREST refuses an `or` on an UPDATE
    // (checked against the live database).
    const read = mem.log.find(
      (q) =>
        q.table === "campaign_recipients" &&
        has(q.chain, "or") &&
        !has(q.chain, "update"),
    );
    expect(argsOf(read?.chain ?? [], "or")).toEqual([RETRYABLE_FAILURE_FILTER]);
    expect(
      mem.log.some((q) => has(q.chain, "update") && has(q.chain, "or")),
    ).toBe(false);
    const requeue = mem.log.find(
      (q) =>
        q.table === "campaign_recipients" &&
        (argsOf(q.chain, "update")?.[0] as { status?: string })?.status ===
          "queued" &&
        has(q.chain, "in"),
    );
    expect(argsOf(requeue?.chain ?? [], "in")).toEqual(["id", ["row-1"]]);
  });

  test("the filter keeps unconfirmed and skipped failures out, and the null ones in", () => {
    expect(RETRYABLE_FAILURE_FILTER).toBe(
      "error.is.null,and(error.not.like.[unconfirmed]*,error.not.like.[skipped]*)",
    );
  });

  test("only the retryable failures are sent again", async () => {
    const { mem, deps, sender } = setup(5, {
      campaign: campaign({ status: "sent" }),
      rows: [
        { id: "row-1", status: "failed", error: "131049: frequency cap" },
        { id: "row-2", status: "failed", error: "[unconfirmed] 5xx" },
        { id: "row-3", status: "failed", error: "[skipped] opted_out" },
        { id: "row-4", status: "failed", error: null },
        { id: "row-5", status: "failed", error: "[unconfirmed] interrupted" },
      ],
    });
    const result = await retryFailed("camp-1", {}, deps);
    expect(result).toMatchObject({ ok: true, sent: 2 });
    expect(sender.calls.map((c) => c.to)).toEqual([
      "+34600000001",
      "+34600000004",
    ]);
    expect(mem.error("row-2")).toBe("[unconfirmed] 5xx");
    expect(mem.error("row-3")).toBe("[skipped] opted_out");
    expect(mem.status("row-5")).toBe("failed");
  });

  test("with nothing to send again the campaign is left exactly as it was", async () => {
    const { mem, deps, sender } = setup(2, {
      campaign: campaign({ status: "failed", last_error: "empty_audience" }),
      rows: [
        { id: "row-1", status: "failed", error: "[unconfirmed] 5xx" },
        { id: "row-2", status: "failed", error: "[skipped] no_consent" },
      ],
    });
    const result = await retryFailed("camp-1", {}, deps);
    expect(result).toEqual({ ok: false, error: "nothing_to_retry" });
    expect(mem.campaign.status).toBe("failed");
    expect(mem.campaign.last_error).toBe("empty_audience");
    expect(touchedCampaign(mem.log)).toHaveLength(0);
    expect(sender.calls).toHaveLength(0);
  });

  test("a campaign with no rows at all has nothing to retry", async () => {
    const { mem, deps } = setup(0, { campaign: campaign({ status: "sent" }) });
    expect(await retryFailed("camp-1", {}, deps)).toEqual({
      ok: false,
      error: "nothing_to_retry",
    });
    expect(mem.campaign.status).toBe("sent");
  });

  test("queued rows alone are reason enough to reopen", async () => {
    const { mem, deps, sender } = setup(3, {
      campaign: campaign({ status: "failed" }),
    });
    const result = await retryFailed("camp-1", {}, deps);
    expect(result).toMatchObject({ ok: true, sent: 3 });
    expect(sender.calls).toHaveLength(3);
    expect(mem.campaign.status).toBe("sent");
  });

  test("an email retry keeps requeueing every failed row", async () => {
    // The requeue is made to fail so the test stops before anything could be
    // mailed: only the shape of the requeue is under test.
    const { mem, deps } = setup(1, {
      campaign: campaign({ channel: "email", status: "sent" }),
      failUpdate: ({ patch }) => (patch.status === "queued" ? "stop" : null),
    });
    expect(await retryFailed("camp-1", {}, deps)).toMatchObject({
      ok: false,
      error: "db",
    });
    const requeue = mem.log.find(
      (q) =>
        q.table === "campaign_recipients" &&
        (argsOf(q.chain, "update")?.[0] as { status?: string })?.status ===
          "queued",
    );
    expect(requeue).toBeDefined();
    expect(has(requeue?.chain ?? [], "or")).toBe(false);
  });
});
