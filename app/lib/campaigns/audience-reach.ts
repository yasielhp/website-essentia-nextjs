/**
 * What the audience preview answered, as the form needs it: a reach, or the fact
 * that it could not be calculated. A failure used to be turned into a count of
 * zero, which let the admin confirm an audience on the strength of "nobody"
 * when the truth was "unknown". Pure, so a test can pin the two apart.
 */
export type Reach = { count: number; en: number; es: number };
export type ReachOutcome =
  | { ok: true; reach: Reach }
  /** `notReady`: the server is missing something an administrator must set up; trying again changes nothing. */
  | { ok: false; notReady?: true };

/** What the preview answers when the list of numbers that wrote STOP does not exist yet. */
export const WHATSAPP_NOT_READY = "whatsapp_not_ready";

/**
 * Whether an error says the table of suppressed phones is not there (its
 * migration has not been applied), as opposed to a database that could not be
 * reached for a moment. Postgres answers the first with "relation ... does not
 * exist" (code 42P01), naming the table; anything else, a timeout, a refused
 * connection, a permission, is transient or someone else's and stays a retry.
 * The send keeps failing closed either way: this only chooses the words.
 */
export function isSuppressionTableMissing(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /relation "(?:public\.)?whatsapp_suppressed_phones" does not exist/i.test(
    message,
  );
}

export function reachOutcome(result: unknown): ReachOutcome {
  if (typeof result !== "object" || result === null) return { ok: false };
  if ((result as { error?: unknown }).error === WHATSAPP_NOT_READY) {
    return { ok: false, notReady: true };
  }
  const { count, byLanguage } = result as {
    count?: unknown;
    byLanguage?: { en?: unknown; es?: unknown } | null;
  };
  if (
    typeof count !== "number" ||
    typeof byLanguage?.en !== "number" ||
    typeof byLanguage?.es !== "number"
  ) {
    return { ok: false };
  }
  return { ok: true, reach: { count, en: byLanguage.en, es: byLanguage.es } };
}
