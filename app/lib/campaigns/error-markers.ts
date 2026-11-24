/**
 * The words a send writes into `campaign_recipients.error` and
 * `campaigns.last_error`, and how to read them back.
 *
 * Pure and free of server imports, so the dashboard can recognise a marker
 * without pulling the sender into the browser. `dispatch-whatsapp.ts`
 * re-exports every name here for the code that already imports it from there.
 */

/** Begins the `error` of a row whose delivery is in doubt; a retry skips it. */
export const UNCONFIRMED_PREFIX = "[unconfirmed] ";

/**
 * Begins the `error` of a row that was not sent because its contact may no
 * longer be messaged (or never could be). A retry leaves it alone.
 */
export const SKIPPED_PREFIX = "[skipped] ";

/**
 * Begins the `last_error` of a campaign or automation stopped on repeated
 * refusals. The text after it is Meta's, as stored on the rows; the prefix is
 * stable so the dashboard can say it in the admin's language.
 */
export const HALTED_PREFIX = "[halted] ";

export const haltMessage = (error: string): string =>
  `${HALTED_PREFIX}${error}`;

/**
 * The same marker for ONE language of a campaign written in two: Meta kept
 * refusing the template of that language (`(es)` or `(en)`, right after the
 * prefix, where Meta's own words cannot put it), and only that language
 * stopped. While the campaign runs, its rows are held in the queue.
 */
export const haltMessageIn = (locale: "es" | "en", error: string): string =>
  `${HALTED_PREFIX}(${locale}) ${error}`;

const LOCALE_HALT = /^\[halted\] \((es|en)\) ([\s\S]*)$/;

/** The language and the reason of a `haltMessageIn`, or null for anything else. */
export function parseLocaleHalt(
  lastError: string | null | undefined,
): { locale: "es" | "en"; reason: string } | null {
  const match = LOCALE_HALT.exec(lastError ?? "");
  return match
    ? { locale: match[1] as "es" | "en", reason: match[2] ?? "" }
    : null;
}

/**
 * The reason inside a `haltMessage` (or a `haltMessageIn`, without its
 * language), or null when `lastError` is something else.
 */
export function parseHalted(
  lastError: string | null | undefined,
): string | null {
  const inOne = parseLocaleHalt(lastError);
  if (inOne) return inOne.reason;
  return lastError?.startsWith(HALTED_PREFIX)
    ? lastError.slice(HALTED_PREFIX.length)
    : null;
}

/** The `error` of a row found in `sending` long after its process died. */
export const INTERRUPTED_ERROR = `${UNCONFIRMED_PREFIX}interrupted`;
