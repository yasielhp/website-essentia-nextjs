import type { SessionTypeInput, SessionTypeSaveResult } from "@/types/settings";
import type { FormState } from "./tier-form-state";

/**
 * The saving side of the session-type modal, away from its markup: what the
 * form sends, and a wait that always ends.
 *
 * PURE and safe for the browser: it imports types only.
 */

/**
 * How long the modal waits for the save before it gives the screen back.
 *
 * The action has a deadline of its own on the server, shorter than this. This
 * one is for what that deadline cannot see: the request never reaching the
 * server, or the action waiting its turn behind another one (Next runs a
 * page's server actions one at a time). Without it the modal stayed on
 * "Saving…" for as long as that lasted.
 */
export const TIER_SAVE_LIMIT_MS = 12_000;

/** Empty is "none". Anything else is the number typed, for the server to judge. */
const amount = (typed: string): number | null =>
  typed.trim() === "" ? null : parseFloat(typed);

/**
 * The form as the server takes it. Nothing is tidied here on the quiet: a
 * price with three decimals or a text that is not a number goes as it is and
 * the server refuses it with a reason, instead of being rounded or emptied
 * without a word. `staffIds` is `null` when the modal never got to read the
 * assignments, so an unread list is not sent as "nobody".
 */
export function tierPayload(
  form: FormState,
  staffIds: string[] | null,
): SessionTypeInput {
  return {
    duration_minutes:
      form.duration.trim() === "" ? null : parseInt(form.duration, 10),
    // `price_eur` is the amount the public booking flow charges.
    price_eur: amount(form.priceWeb),
    price_center_eur: amount(form.priceCenter),
    price_suite_eur: amount(form.priceSuite),
    color: form.color || null,
    active: form.active,
    staffIds,
  };
}

const isResult = (value: unknown): value is SessionTypeSaveResult =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { ok?: unknown }).ok === "boolean";

/**
 * Runs the save and ALWAYS answers: with its result, with `timeout` when
 * `limitMs` pass first, with `failed` when the call itself breaks (no network,
 * a deploy in the middle). Never rejects, so the modal has one path out of
 * "Saving…" whatever happens.
 *
 * A `timeout` does not mean it was not saved: the request may still land.
 */
export function saveWithin(
  save: () => Promise<SessionTypeSaveResult>,
  limitMs: number = TIER_SAVE_LIMIT_MS,
): Promise<SessionTypeSaveResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, error: "timeout" }),
      limitMs,
    );
    const done = (result: SessionTypeSaveResult) => {
      clearTimeout(timer);
      resolve(result);
    };
    Promise.resolve()
      .then(save)
      .then(
        (result) =>
          done(isResult(result) ? result : { ok: false, error: "failed" }),
        () => done({ ok: false, error: "failed" }),
      );
  });
}
