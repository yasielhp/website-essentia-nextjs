import { describe, expect, test } from "bun:test";
import { EMPTY_AUDIENCE } from "@/types/campaign";
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
      "[halted] 132000: Template param mismatch",
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

describe("runAutomation for an appointment notice", () => {
  const ACTIVATED = "2026-11-01T00:00:00Z";
  const notice = (over: Record<string, unknown> = {}) =>
    campaign({
      status: "active",
      kind: "appointment",
      trigger: { event: "before_visit", hours: 24 },
      activated_at: ACTIVATED,
      audience: { ...EMPTY_AUDIENCE, language: "es", sendLocale: "es" },
      ...over,
    });

  const appt = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    serviceId: "svc-1",
    status: "confirmed" as const,
    startsAt: "2026-11-18T09:00:00.000Z",
    endsAt: "2026-11-18T10:00:00.000Z",
    visit: {
      service: "Drenaje linfático",
      sessionType: "Sesión individual",
      date: "2026-11-18",
      time: "09:00",
    },
    ...over,
  });

  const withAppointments = (n: number, appointments: unknown[]): Recipient =>
    ({ ...recipient(n), language: "es", appointments }) as Recipient;

  test("resolves the audience for appointments, with the consent to appointment notices", async () => {
    const mem = memoryDb(rowsOf(0), { campaign: notice() });
    const calls: unknown[][] = [];
    await runAutomation(notice(), NOW, {
      db: mem.db,
      resolveAudience: async (...args) => {
        calls.push(args);
        return [];
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[2]).toBe("whatsapp");
    expect(calls[0]?.[3]).toEqual({
      purpose: "appointment",
      appointments: true,
    });
  });

  test("every other kind is resolved exactly as before: three arguments, nothing more", async () => {
    for (const kind of ["automated", "autoresponder", "dateBased"] as const) {
      const mem = memoryDb(rowsOf(0), { campaign: automated() });
      const calls: unknown[][] = [];
      await runAutomation({ ...automated(), kind }, NOW, {
        db: mem.db,
        resolveAudience: async (...args) => {
          calls.push(args);
          return [];
        },
      });
      expect(calls[0]).toHaveLength(3);
    }
  });

  test("queues one row per booking, with the booking as its cycle and what the message says about it", async () => {
    const mem = memoryDb(rowsOf(0), { campaign: notice() });
    const result = await runAutomation(notice(), NOW, {
      db: mem.db,
      resolveAudience: async () => [
        withAppointments(1, [
          appt("b1"),
          appt("b2", {
            startsAt: "2026-11-18T11:00:00.000Z",
            visit: {
              service: "Masaje",
              sessionType: null,
              date: "2026-11-18",
              time: "11:00",
            },
          }),
        ]),
      ],
    });
    expect(result.queued).toBe(2);
    const [{ rows, options }] = mem.upserts;
    expect(rows.map((r) => r.cycle)).toEqual(["b1", "b2"]);
    // The same client, the same number, two bookings: two rows.
    expect(new Set(rows.map((r) => r.phone))).toEqual(
      new Set(["+34600000001"]),
    );
    expect(rows[0]?.vars).toMatchObject({
      service: "Drenaje linfático",
      time: "09:00",
    });
    expect(rows[1]?.vars).toMatchObject({ service: "Masaje" });
    expect(options).toEqual({
      onConflict: "campaign_id,phone,cycle",
      ignoreDuplicates: true,
    });
  });

  test("a second run asks for the same rows: the unique index makes it one notice per booking", async () => {
    const mem = memoryDb(rowsOf(0), { campaign: notice() });
    const deps = {
      db: mem.db,
      resolveAudience: async () => [withAppointments(1, [appt("b1")])],
    };
    await runAutomation(notice(), NOW, deps);
    await runAutomation(notice(), new Date(NOW.getTime() + 15 * 60_000), deps);
    expect(mem.upserts[0]?.rows.map((r) => r.cycle)).toEqual(["b1"]);
    expect(mem.upserts[1]?.rows.map((r) => r.cycle)).toEqual(["b1"]);
    expect(mem.upserts[1]?.options).toMatchObject({ ignoreDuplicates: true });
  });

  test("owes nothing, and writes nothing, before the moment", async () => {
    const mem = memoryDb(rowsOf(0), { campaign: notice() });
    const result = await runAutomation(notice(), NOW, {
      db: mem.db,
      // 09:00 tomorrow is 21 hours away; the notice is due 24 hours before.
      resolveAudience: async () =>
        [
          withAppointments(1, [
            appt("b1", { startsAt: "2026-11-18T09:00:00.000Z" }),
          ]),
        ].map((r) => r),
    });
    // NOW is 12:00 on the 17th: 24 h before 09:00 on the 18th was 09:00 on the
    // 17th, three hours ago, after activation: due.
    expect(result.queued).toBe(1);
    const far = memoryDb(rowsOf(0), { campaign: notice() });
    const none = await runAutomation(notice(), NOW, {
      db: far.db,
      resolveAudience: async () => [
        withAppointments(1, [
          appt("b1", { startsAt: "2026-11-20T09:00:00.000Z" }),
        ]),
      ],
    });
    expect(none.queued).toBe(0);
    expect(far.upserts).toHaveLength(0);
  });

  test("does not reach back before it was switched on", async () => {
    const mem = memoryDb(rowsOf(0), { campaign: notice() });
    const result = await runAutomation(
      notice({ activated_at: "2026-11-17T11:00:00Z" }),
      NOW,
      {
        db: mem.db,
        resolveAudience: async () => [withAppointments(1, [appt("b1")])],
      },
    );
    // The moment (09:00 on the 17th) is before the activation (11:00).
    expect(result.queued).toBe(0);
  });

  test("a campaign limited to some services only takes the bookings of those", async () => {
    const mem = memoryDb(rowsOf(0), {
      campaign: notice({
        audience: {
          ...EMPTY_AUDIENCE,
          language: "es",
          sendLocale: "es",
          services: ["svc-2"],
        },
      }),
    });
    const result = await runAutomation(
      notice({
        audience: {
          ...EMPTY_AUDIENCE,
          language: "es",
          sendLocale: "es",
          services: ["svc-2"],
        },
      }),
      NOW,
      {
        db: mem.db,
        resolveAudience: async () => [
          withAppointments(1, [
            appt("b1", { serviceId: "svc-1" }),
            appt("b2", { serviceId: "svc-2" }),
          ]),
        ],
      },
    );
    expect(result.queued).toBe(1);
    expect(mem.upserts[0]?.rows.map((r) => r.cycle)).toEqual(["b2"]);
  });

  test("after_visit runs the same way, on the end of the booking", async () => {
    const mem = memoryDb(rowsOf(0), {
      campaign: notice({ trigger: { event: "after_visit", hours: 2 } }),
    });
    const past = appt("b1", {
      startsAt: "2026-11-17T09:00:00.000Z",
      endsAt: "2026-11-17T10:00:00.000Z",
    });
    const result = await runAutomation(
      notice({ trigger: { event: "after_visit", hours: 2 } }),
      NOW,
      {
        db: mem.db,
        resolveAudience: async () => [withAppointments(1, [past])],
      },
    );
    // Ended at 10:00, two hours later is 12:00, which is NOW.
    expect(result.queued).toBe(1);
    expect(mem.upserts[0]?.rows[0]?.cycle).toBe("b1");
  });
});
