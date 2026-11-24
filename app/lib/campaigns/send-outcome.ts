import type { DispatchResult } from "./dispatch";

/**
 * What a send action tells the browser. A WhatsApp send may stop early:
 * `remaining` rows are left for the cron, `unrecorded` messages went out
 * without their row being updated, and `halted` carries the reason Meta kept
 * refusing it.
 */
export type SendOutcome = {
  ok: true;
  sent: number;
  failed: number;
  remaining?: number;
  unrecorded?: number;
  halted?: string;
};

export type SendFailure = {
  ok: false;
  error: string;
  /** Only for `template_unavailable`: the eligibility code. */
  detail?: string;
  /** Only for `template_unavailable`: the language whose template it is. */
  locale?: "es" | "en";
};

/**
 * `detail` reaches the browser only when it is a code we defined. For `db` it
 * is Postgres's own message, which names tables and columns and stays on the
 * server.
 */
export function sendOutcome(result: DispatchResult): SendOutcome | SendFailure {
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.error === "template_unavailable" && result.detail
        ? {
            detail: result.detail,
            ...(result.locale ? { locale: result.locale } : {}),
          }
        : {}),
    };
  }
  return {
    ok: true,
    sent: result.sent,
    failed: result.failed,
    ...(result.remaining ? { remaining: result.remaining } : {}),
    ...(result.unrecorded ? { unrecorded: result.unrecorded } : {}),
    // Present means halted, whatever the reason says: an empty text is
    // Meta saying nothing, not a send that went well.
    ...(typeof result.halted === "string" ? { halted: result.halted } : {}),
  };
}
