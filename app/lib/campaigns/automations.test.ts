import { describe, expect, test } from "bun:test";
import type { Recipient } from "./audience-filter";
import { runAutomation } from "./automations";
import { INTERRUPTED_ERROR } from "./dispatch-whatsapp";
import { campaign, fakeSend, memoryDb, ok, rowsOf } from "./whatsapp-fixtures";

const NOW = new Date("2026-11-17T12:00:00Z");

const automated = () =>
  campaign({
    status: "active",
    kind: "automated",
    trigger: { event: "segment_entry" },
    activated_at: "2026-11-01T00:00:00Z",
  });

const recipient = (n: number): Recipient => ({
  id: `contact-${n}`,
  email: null,
  firstName: `Nombre${n}`,
  language: "en",
  phone: `+346000000${String(n).padStart(2, "0")}`,
});

describe("runAutomation on WhatsApp", () => {
  test("queues rows by phone, with no email, and sends them", async () => {
    const mem = memoryDb(rowsOf(2), { campaign: automated() });
    const sender = fakeSend(() => ok("w"));
    const result = await runAutomation(automated(), NOW, {
      db: mem.db,
      resolveAudience: async () => [recipient(1), recipient(2)],
      whatsapp: { send: sender.send, sleep: async () => {} },
    });

    expect(result).toEqual({ queued: 2, sent: 2, failed: 0 });
    const [{ rows, options }] = mem.upserts;
    expect(rows[0]).toMatchObject({
      email: null,
      phone: "+34600000001",
      language: "es",
      cycle: "",
    });
    expect(options).toEqual({
      onConflict: "campaign_id,phone,cycle",
      ignoreDuplicates: true,
    });
  });

  test("fails what a dead process left `sending` before it counts anything", async () => {
    const mem = memoryDb(rowsOf(1), {
      campaign: automated(),
      rows: [
        { id: "row-1", status: "sending", claimed_at: "2026-11-17T11:00:00Z" },
      ],
    });
    const sender = fakeSend(() => ok("w"));
    await runAutomation(automated(), NOW, {
      db: mem.db,
      resolveAudience: async () => [],
      whatsapp: { send: sender.send },
    });
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe(INTERRUPTED_ERROR);
    expect(sender.calls).toHaveLength(0);
    // The failure is in the campaign's count.
    expect(mem.campaign.failed_count).toBe(1);
  });

  test("leaves a row claimed a minute ago alone", async () => {
    const mem = memoryDb(rowsOf(1), {
      campaign: automated(),
      rows: [
        { id: "row-1", status: "sending", claimed_at: "2026-11-17T11:59:00Z" },
      ],
    });
    await runAutomation(automated(), NOW, {
      db: mem.db,
      resolveAudience: async () => [],
    });
    expect(mem.status("row-1")).toBe("sending");
  });

  test("an automation Meta keeps refusing is paused with the reason, not left to retry", async () => {
    const mem = memoryDb(rowsOf(45), { campaign: automated() });
    const sender = fakeSend(() => ({
      status: "failed",
      error: "Template param mismatch",
      code: 132000,
    }));
    const result = await runAutomation(automated(), NOW, {
      db: mem.db,
      resolveAudience: async () =>
        Array.from({ length: 45 }, (_, i) => recipient(i + 1)),
      whatsapp: { send: sender.send, sleep: async () => {} },
    });
    expect(result).toMatchObject({
      sent: 0,
      failed: 30,
      halted: "132000: Template param mismatch",
    });
    expect(mem.campaign.status).toBe("paused");
    expect(mem.campaign.last_error).toBe(
      "WhatsApp rechazó 3 lotes seguidos: 132000: Template param mismatch",
    );
    // The rest waits in the queue for when the admin resumes it.
    expect(
      [...mem.rows.values()].filter((r) => r.status === "queued"),
    ).toHaveLength(15);
  });

  test("a healthy run keeps the campaign active", async () => {
    const mem = memoryDb(rowsOf(2), { campaign: automated() });
    await runAutomation(automated(), NOW, {
      db: mem.db,
      resolveAudience: async () => [recipient(1), recipient(2)],
      whatsapp: { send: fakeSend(() => ok("w")).send },
    });
    expect(mem.campaign.status).toBe("active");
  });

  test("a run that has no time left sends nothing and keeps its queue", async () => {
    const mem = memoryDb(rowsOf(2), { campaign: automated() });
    const sender = fakeSend(() => ok("w"));
    const result = await runAutomation(automated(), NOW, {
      db: mem.db,
      resolveAudience: async () => [recipient(1), recipient(2)],
      whatsapp: { send: sender.send, now: () => 1_000_000 },
      deadlineAt: 1_000_500,
    });
    expect(sender.calls).toHaveLength(0);
    expect(result).toMatchObject({ queued: 2, sent: 0, failed: 0 });
    expect(mem.status("row-1")).toBe("queued");
  });
});
