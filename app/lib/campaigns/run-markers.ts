/**
 * What a run of an active campaign writes when it cannot tell Meta's or
 * Resend's words: fixed texts, so the dashboard can say them in the admin's
 * language.
 *
 * Pure and free of server imports, like `error-markers.ts`.
 */

import { SKIPPED_PREFIX } from "./error-markers";

/**
 * The `error` of an appointment notice that was still in the queue when its
 * moment had passed, or when its booking had been cancelled or moved: it was
 * not sent and never will be. A `[skipped]` like the others, so a retry leaves
 * it alone.
 */
export const LATE_ERROR = `${SKIPPED_PREFIX}late`;

/**
 * The `last_error` of an active campaign whose run threw (its audience could
 * not be read, say). Deliberately nothing of the error itself, which can quote
 * a row and so a client; the detail is in the server log. The campaign stays
 * `active`: the next tick tries again, and the first run that ends well clears
 * this.
 */
export const RUN_FAILED_ERROR = "[run_failed]";
