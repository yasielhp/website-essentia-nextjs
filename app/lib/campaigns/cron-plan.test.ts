import { describe, expect, test } from "bun:test";
import { orderJobs, runJobs, type CronJob } from "./cron-plan";
import { START_MARGIN_MS } from "./dispatch-whatsapp";

const jobs: CronJob[] = orderJobs({
  scheduled: ["s1", "s2"],
  stuck: [
    { id: "r1", abandon: false },
    { id: "x1", abandon: true },
  ],
  automations: [{ id: "a1" }, { id: "a2" }],
});

describe("orderJobs", () => {
  test("scheduled first, then stuck sends, then automations", () => {
    expect(jobs.map((j) => `${j.kind}:${j.id}`)).toEqual([
      "scheduled:s1",
      "scheduled:s2",
      "resume:r1",
      "abandon:x1",
      "automation:a1",
      "automation:a2",
    ]);
  });

  test("appointment notices go before everything else, the ones before a visit first", () => {
    const ordered = orderJobs({
      scheduled: ["s1"],
      stuck: [
        { id: "r1", abandon: false },
        { id: "x1", abandon: true },
      ],
      automations: [
        { id: "a1", kind: "automated", event: "segment_entry" },
        { id: "after-1", kind: "appointment", event: "after_visit" },
        { id: "before-1", kind: "appointment", event: "before_visit" },
        { id: "a2", kind: "dateBased", event: "birthday" },
        { id: "before-2", kind: "appointment", event: "before_visit" },
        { id: "after-2", kind: "appointment", event: "after_visit" },
      ],
    });
    expect(ordered.map((j) => `${j.kind}:${j.id}`)).toEqual([
      "automation:before-1",
      "automation:before-2",
      "automation:after-1",
      "automation:after-2",
      "scheduled:s1",
      "resume:r1",
      "abandon:x1",
      "automation:a1",
      "automation:a2",
    ]);
  });

  test("a big one-off send that eats the tick does not starve the notices", async () => {
    let t = 1_000_000;
    const ran: string[] = [];
    const out = await runJobs(
      orderJobs({
        scheduled: ["big"],
        stuck: [],
        automations: [
          { id: "welcome", kind: "automated", event: "segment_entry" },
          { id: "reminder", kind: "appointment", event: "before_visit" },
        ],
      }),
      1_000_000 + 50_000,
      async (job) => {
        ran.push(job.id);
        // The one-off campaign uses the whole tick; a notice takes a second.
        t += job.id === "big" ? 50_000 : 1_000;
        return "ran";
      },
      () => t,
    );
    expect(ran).toEqual(["reminder", "big"]);
    expect(out.welcome).toEqual({ deferred: "out of time" });
  });

  test("nothing to do is no jobs", () => {
    expect(orderJobs({ scheduled: [], stuck: [], automations: [] })).toEqual(
      [],
    );
  });
});

describe("runJobs", () => {
  const T = 1_000_000;

  test("with room, every job runs in order", async () => {
    const ran: string[] = [];
    const out = await runJobs(
      jobs,
      T + 50_000,
      async (job) => {
        ran.push(job.id);
        return job.id;
      },
      () => T,
    );
    expect(ran).toEqual(["s1", "s2", "r1", "x1", "a1", "a2"]);
    expect(out.s1).toBe("s1");
  });

  test("a job may start exactly at the margin", async () => {
    const ran: string[] = [];
    await runJobs(
      jobs.slice(0, 1),
      T + START_MARGIN_MS,
      async (job) => {
        ran.push(job.id);
      },
      () => T,
    );
    expect(ran).toEqual(["s1"]);
  });

  test("with the deadline spent nothing runs but the cheap abandon", async () => {
    const ran: string[] = [];
    const out = await runJobs(
      jobs,
      T,
      async (job) => {
        ran.push(job.id);
        return "ran";
      },
      () => T,
    );
    expect(ran).toEqual(["x1"]);
    expect(out.s1).toEqual({ deferred: "out of time" });
    expect(out.s2).toEqual({ deferred: "out of time" });
    expect(out.r1).toEqual({ deferred: "out of time" });
    expect(out.a1).toEqual({ deferred: "out of time" });
    expect(out.x1).toBe("ran");
  });

  test("time runs out half way: the earlier jobs ran, the later ones wait, order kept", async () => {
    let t = T;
    const ran: string[] = [];
    const out = await runJobs(
      jobs,
      T + 20_000,
      async (job) => {
        ran.push(job.id);
        t += 9_000; // each job takes nine seconds
        return "ran";
      },
      () => t,
    );
    // s1 at +0, s2 at +9, r1 at +18 (needs 5 s: 23 > 20, so it waits).
    expect(ran).toEqual(["s1", "s2", "x1"]);
    expect(out.r1).toEqual({ deferred: "out of time" });
    expect(out.a1).toEqual({ deferred: "out of time" });
    expect(out.a2).toEqual({ deferred: "out of time" });
  });
});
