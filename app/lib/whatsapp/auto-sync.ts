/**
 * When the templates page asks Meta for the account's templates by itself.
 *
 * Nobody presses a button for it: the page asks when it is opened, and a cron
 * asks every hour. This is the page's side. It asks only when the copy is at
 * least ten minutes old, and never twice within ten minutes from one browser,
 * so an account with no templates at all (whose copy never gets a sync date)
 * does not ask on every visit.
 */
export const AUTO_SYNC_EVERY_MS = 10 * 60 * 1000;

export function shouldAutoSync({
  configured,
  lastSyncMs,
  lastAttemptMs,
  nowMs,
}: {
  /** The server can reach the account's templates at all. */
  configured: boolean;
  /** When the newest sync wrote the copy, or null if none ever did. */
  lastSyncMs: number | null;
  /** When this browser last asked, or null if it has not. */
  lastAttemptMs: number | null;
  nowMs: number;
}): boolean {
  if (!configured) return false;
  if (lastAttemptMs !== null && nowMs - lastAttemptMs < AUTO_SYNC_EVERY_MS) {
    return false;
  }
  return lastSyncMs === null || nowMs - lastSyncMs >= AUTO_SYNC_EVERY_MS;
}
