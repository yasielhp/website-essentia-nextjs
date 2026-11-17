import { outOfTime } from "./deadline";

/**
 * The order the campaigns cron does its work in, and what it does when the
 * invocation's time runs out. Pure, so the order and the cut-off are tested
 * without a database.
 *
 * Priority: the appointment notices first, because they are the only work
 * that expires (a notice more than 45 minutes late is lost, and a big one-off
 * campaign can use up the whole tick several ticks in a row); the ones before
 * a visit ahead of the ones after it, whose margin is hours. Then scheduled
 * campaigns (somebody is waiting for them at a set hour), then the ones a
 * previous tick left half done, then the other automations.
 */

export type CronJob = {
  kind: "scheduled" | "resume" | "abandon" | "automation";
  id: string;
};

/** An active campaign, with what the order needs to know about it. */
export type AutomationJob = {
  id: string;
  kind?: string;
  /** Its trigger's event. */
  event?: string;
};

export type Deferred = { deferred: "out of time" };

export function orderJobs(input: {
  scheduled: string[];
  /** `abandon` is for a send nobody has claimed in two hours. */
  stuck: { id: string; abandon: boolean }[];
  automations: AutomationJob[];
}): CronJob[] {
  const automation = ({ id }: AutomationJob): CronJob => ({
    kind: "automation",
    id,
  });
  const notices = input.automations.filter((a) => a.kind === "appointment");
  return [
    ...notices.filter((a) => a.event === "before_visit").map(automation),
    ...notices.filter((a) => a.event !== "before_visit").map(automation),
    ...input.scheduled.map((id): CronJob => ({ kind: "scheduled", id })),
    ...input.stuck.map((s): CronJob => ({
      kind: s.abandon ? "abandon" : "resume",
      id: s.id,
    })),
    ...input.automations
      .filter((a) => a.kind !== "appointment")
      .map(automation),
  ];
}

/**
 * Runs the jobs in order. A job that would start with too little time left is
 * not run and is reported as deferred; it stays scheduled or queued for the
 * next tick. Abandoning a stuck send is one cheap UPDATE and always runs.
 */
export async function runJobs<T>(
  jobs: CronJob[],
  deadlineAt: number,
  run: (job: CronJob) => Promise<T>,
  now: () => number = Date.now,
): Promise<Record<string, T | Deferred>> {
  const results: Record<string, T | Deferred> = {};
  for (const job of jobs) {
    if (job.kind !== "abandon" && outOfTime(deadlineAt, now())) {
      results[job.id] = { deferred: "out of time" };
      continue;
    }
    results[job.id] = await run(job);
  }
  return results;
}
