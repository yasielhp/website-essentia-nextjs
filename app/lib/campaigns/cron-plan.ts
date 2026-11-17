import { outOfTime } from "./deadline";

/**
 * The order the campaigns cron does its work in, and what it does when the
 * invocation's time runs out. Pure, so the order and the cut-off are tested
 * without a database.
 *
 * Priority: scheduled campaigns first (somebody is waiting for them at a set
 * hour), then the ones a previous tick left half done, then the automations.
 */

export type CronJob = {
  kind: "scheduled" | "resume" | "abandon" | "automation";
  id: string;
};

export type Deferred = { deferred: "out of time" };

export function orderJobs(input: {
  scheduled: string[];
  /** `abandon` is for a send nobody has claimed in two hours. */
  stuck: { id: string; abandon: boolean }[];
  automations: string[];
}): CronJob[] {
  return [
    ...input.scheduled.map((id): CronJob => ({ kind: "scheduled", id })),
    ...input.stuck.map((s): CronJob => ({
      kind: s.abandon ? "abandon" : "resume",
      id: s.id,
    })),
    ...input.automations.map((id): CronJob => ({ kind: "automation", id })),
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
