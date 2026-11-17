import { START_MARGIN_MS } from "./dispatch-whatsapp";

/**
 * The time one invocation (a cron tick, a manual send) lets a WhatsApp send
 * use. Vercel kills the function at `maxDuration` (60 s); this leaves ten
 * seconds for what follows the sender: recounting, the next campaign's checks,
 * the response.
 */
export const INVOCATION_DEADLINE_MS = 50_000;

/** The instant by which an invocation that began at `startedAt` must be over. */
export const deadlineFrom = (startedAt: number): number =>
  startedAt + INVOCATION_DEADLINE_MS;

/** True when too little is left to begin another send. */
export const outOfTime = (deadlineAt: number, now = Date.now()): boolean =>
  now + START_MARGIN_MS > deadlineAt;
