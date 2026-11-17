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

/** The reason inside a `haltMessage`, or null when `lastError` is something else. */
export function parseHalted(
  lastError: string | null | undefined,
): string | null {
  return lastError?.startsWith(HALTED_PREFIX)
    ? lastError.slice(HALTED_PREFIX.length)
    : null;
}

/** The `error` of a row found in `sending` long after its process died. */
export const INTERRUPTED_ERROR = `${UNCONFIRMED_PREFIX}interrupted`;
