import { describe, expect, spyOn, test } from "bun:test";
import { EMPTY_AUDIENCE } from "@/types/campaign";
import type { Recipient } from "./audience-filter";
import { runAutomation } from "./automations";
import { INTERRUPTED_ERROR } from "./dispatch-whatsapp";
import { LATE_ERROR, RUN_FAILED_ERROR } from "./run-markers";
import {
  campaign,
  fakeSend,
  memoryDb,
  noticesOnly,
  ok,
  row,
  rowsOf,
  template,
  type MemoryDbOptions,
} from "./whatsapp-fixtures";

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

  test("a run that ends well clears the mark the cron left when an earlier run threw", async () => {
    const marked = () => ({ ...automated(), last_error: RUN_FAILED_ERROR });
    const mem = memoryDb(rowsOf(2), { campaign: marked() });
    await runAutomation(marked(), NOW, {
      db: mem.db,
      resolveAudience: async () => [recipient(1), recipient(2)],
      whatsapp: { send: fakeSend(() => ok("w")).send },
    });
    expect(mem.campaign.last_error).toBeNull();
  });

  test("a run with nothing to do clears that mark too: it ran", async () => {
    const marked = () => ({ ...automated(), last_error: RUN_FAILED_ERROR });
    const mem = memoryDb(rowsOf(0), { campaign: marked() });
    await runAutomation(marked(), NOW, {
      db: mem.db,
      resolveAudience: async () => [],
    });
    expect(mem.campaign.last_error).toBeNull();
  });

  test("any other error on the campaign is not the run's to clear", async () => {
    const waiting = () => ({
      ...automated(),
      last_error: "template_unavailable: template_not_approved",
    });
    const mem = memoryDb(rowsOf(0), { campaign: waiting() });
    await runAutomation(waiting(), NOW, {
      db: mem.db,
      resolveAudience: async () => [],
    });
    expect(mem.campaign.last_error).toBe(
      "template_unavailable: template_not_approved",
    );
  });

  test("a run that ends with an error of its own replaces the mark with it", async () => {
    const marked = () => ({ ...automated(), last_error: RUN_FAILED_ERROR });
    const mem = memoryDb(rowsOf(1), {
      campaign: marked(),
      template: template({ status: "PAUSED" }),
    });
    await runAutomation(marked(), NOW, {
      db: mem.db,
      resolveAudience: async () => [recipient(1)],
      whatsapp: { send: fakeSend(() => ok("w")).send },
    });
    expect(mem.campaign.last_error).toBe(
      "template_unavailable: template_not_approved",
    );
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
    // 24 hours before this is 11:30 on the 17th: 30 minutes before NOW.
    startsAt: "2026-11-18T11:30:00.000Z",
    endsAt: "2026-11-18T12:30:00.000Z",
    visit: {
      service: "Drenaje linfático",
      sessionType: "Sesión individual",
      date: "2026-11-18",
      time: "11:30",
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
            startsAt: "2026-11-18T11:45:00.000Z",
            visit: {
              service: "Masaje",
              sessionType: null,
              date: "2026-11-18",
              time: "11:45",
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
      time: "11:30",
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
      // The visit is at 11:30 tomorrow: the notice was due at 11:30 today.
      resolveAudience: async () =>
        [
          withAppointments(1, [
            appt("b1", { startsAt: "2026-11-18T11:30:00.000Z" }),
          ]),
        ].map((r) => r),
    });
    // NOW is 12:00 on the 17th: 24 h before 11:30 on the 18th was 11:30 on the
    // 17th, half an hour ago, after activation and inside the bound: due.
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
      notice({ activated_at: "2026-11-17T11:40:00Z" }),
      NOW,
      {
        db: mem.db,
        resolveAudience: async () => [withAppointments(1, [appt("b1")])],
      },
    );
    // The moment (11:30 on the 17th) is before the activation (11:40).
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

  describe("a notice that was left in the queue", () => {
    const MINUTE = 60_000;
    const later = (minutes: number) =>
      new Date(NOW.getTime() + minutes * MINUTE);
    const utility = (over: Record<string, unknown> = {}) =>
      template({ category: "UTILITY", ...over });

    /**
     * The notice of booking `b1` (owed since 11:30, half an hour before NOW),
     * queued by an earlier tick and never sent.
     */
    const waiting = (over: MemoryDbOptions = {}, bookings = ["b1"]) => {
      const opts: MemoryDbOptions = {
        campaign: notice(),
        contacts: [noticesOnly("contact-1")],
        template: utility(),
        ...over,
      };
      // One client, one number, a row per booking.
      const mem = memoryDb(
        bookings.map((cycle, i) =>
          row(i + 1, {
            cycle,
            contact_id: "contact-1",
            phone: "+34600000001",
          }),
        ),
        opts,
      );
      const sender = fakeSend(() => ok("w"));
      const tick = (at: Date, appointments: unknown[]) =>
        runAutomation(notice(), at, {
          db: mem.db,
          resolveAudience: async () => [withAppointments(1, appointments)],
          whatsapp: { send: sender.send, sleep: async () => {} },
        });
      return { mem, sender, tick, opts };
    };

    test("held by a paused template and found past its margin: closed as late, never sent", async () => {
      const { mem, sender, tick, opts } = waiting({
        template: utility({ status: "PAUSED" }),
      });
      const first = await tick(NOW, [appt("b1")]);
      expect(first).toMatchObject({ sent: 0, failed: 0 });
      expect(mem.status("row-1")).toBe("queued");

      // Meta lets the template go again an hour later: 90 minutes past the
      // notice's moment, twice the margin.
      opts.template = utility();
      const second = await tick(later(60), [appt("b1")]);
      expect(sender.calls).toHaveLength(0);
      expect(mem.status("row-1")).toBe("failed");
      expect(mem.error("row-1")).toBe("[skipped] late");
      expect(LATE_ERROR).toBe("[skipped] late");
      expect(second).toMatchObject({ sent: 0, late: 1 });
      // In the campaign's count like any other row that was not sent.
      expect(mem.campaign.failed_count).toBe(1);
      expect(mem.campaign.status).toBe("active");
    });

    test("found again inside its margin: it goes out", async () => {
      const { mem, sender, tick, opts } = waiting({
        template: utility({ status: "PAUSED" }),
      });
      await tick(NOW, [appt("b1")]);
      opts.template = utility();
      // 40 minutes past the moment: still inside the 45.
      const second = await tick(later(10), [appt("b1")]);
      expect(sender.calls).toHaveLength(1);
      expect(mem.status("row-1")).toBe("sent");
      expect(second).toEqual({ queued: 1, sent: 1, failed: 0 });
    });

    test("a booking cancelled between the queue and the send gets no notice", async () => {
      const { mem, sender, tick, opts } = waiting({
        template: utility({ status: "PAUSED" }),
      });
      await tick(NOW, [appt("b1")]);
      opts.template = utility();
      // Still inside the margin, but the resolver no longer returns the
      // booking: a cancelled one is not an appointment.
      await tick(later(10), []);
      expect(sender.calls).toHaveLength(0);
      expect(mem.status("row-1")).toBe("failed");
      expect(mem.error("row-1")).toBe(LATE_ERROR);
    });

    test("a booking moved out of its window gets no notice for the hour it no longer has", async () => {
      const { mem, sender, tick } = waiting();
      await tick(later(10), [
        appt("b1", { startsAt: "2026-11-25T11:30:00.000Z" }),
      ]);
      expect(sender.calls).toHaveLength(0);
      expect(mem.error("row-1")).toBe(LATE_ERROR);
    });

    test("a visit that has started is not reminded of, whatever was queued", async () => {
      // A "2 hours before" queued at 9:30 for an 11:30 visit, found at 12:00.
      const { mem, sender } = waiting();
      await runAutomation(
        notice({ trigger: { event: "before_visit", hours: 2 } }),
        NOW,
        {
          db: mem.db,
          resolveAudience: async () => [
            withAppointments(1, [
              appt("b1", { startsAt: "2026-11-17T11:30:00.000Z" }),
            ]),
          ],
          whatsapp: { send: sender.send },
        },
      );
      expect(sender.calls).toHaveLength(0);
      expect(mem.error("row-1")).toBe(LATE_ERROR);
    });

    test("only the late one is closed: the notice owed on this tick still goes out", async () => {
      const { mem, sender, tick } = waiting({}, ["b1", "b2"]);
      const result = await tick(NOW, [
        appt("b1"),
        // Booking b2 was moved a week on after its notice was queued.
        appt("b2", { startsAt: "2026-11-25T11:30:00.000Z" }),
      ]);
      expect(sender.calls).toHaveLength(1);
      expect(mem.status("row-1")).toBe("sent");
      expect(mem.status("row-2")).toBe("failed");
      expect(mem.error("row-2")).toBe(LATE_ERROR);
      expect(result).toMatchObject({ sent: 1, late: 1 });
    });

    test("a row for a number the client no longer has is not this tick's notice", async () => {
      const mem = memoryDb([row(1, { cycle: "b1", phone: "+34699999999" })], {
        campaign: notice(),
        contacts: [noticesOnly("contact-1")],
        template: utility(),
      });
      const sender = fakeSend(() => ok("w"));
      await runAutomation(notice(), NOW, {
        db: mem.db,
        resolveAudience: async () => [withAppointments(1, [appt("b1")])],
        whatsapp: { send: sender.send },
      });
      expect(sender.calls).toHaveLength(0);
      expect(mem.error("row-1")).toBe(LATE_ERROR);
    });

    test("a late row that cannot be closed is still not sent", async () => {
      const quiet = spyOn(console, "error").mockImplementation(() => {});
      const { mem, sender, tick } = waiting({
        failUpdate: ({ patch }) =>
          patch.error === LATE_ERROR ? "connection reset" : null,
      });
      const result = await tick(later(60), [appt("b1")]);
      quiet.mockRestore();
      expect(sender.calls).toHaveLength(0);
      expect(mem.status("row-1")).toBe("queued");
      expect(result).toEqual({ queued: 0, sent: 0, failed: 0 });
    });

    test("every other kind keeps sending whatever it finds queued, as before", async () => {
      // An automation's row left by a tick that ran out of time, for somebody
      // who is no longer in the segment.
      const mem = memoryDb([row(1, { cycle: "" })], { campaign: automated() });
      const sender = fakeSend(() => ok("w"));
      const result = await runAutomation(automated(), NOW, {
        db: mem.db,
        resolveAudience: async () => [],
        whatsapp: { send: sender.send },
      });
      expect(sender.calls).toHaveLength(1);
      expect(result).toEqual({ queued: 0, sent: 1, failed: 0 });
    });
  });
});
