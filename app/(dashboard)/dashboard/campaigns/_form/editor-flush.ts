import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import type { FormAction } from "./form-state";

/**
 * The email editor's words on their way to the form. Pure (the timers are
 * handed in), so the content step and its tests run the same code.
 *
 * The editor owns its document while the admin types; the form is told a beat
 * after the last keystroke (`DELAY_MS`), so a fast sentence is one state
 * update. Until then the words exist only in the editor, and the editor of a
 * language is replaced when the language on screen changes: whatever is about
 * to change it (the language switch, the "confirm" of the step, the step
 * folding away) writes them first, with the language they were typed in, so
 * they are neither lost nor written into the other language.
 */

/** The beat after the last keystroke at which the form is told. */
export const DELAY_MS = 300;

export type Timers = {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

const browserTimers: Timers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type DocFlusher = {
  /** The editor of `locale` changed; `read` gives its document. */
  typed: (locale: CampaignLocale, read: () => EmailDoc) => void;
  /**
   * Writes what the editor has not handed over yet, now, and answers the
   * action it dispatched (null when there was nothing): a caller about to
   * judge the form passes it on, since its own `state` was read before it.
   */
  flush: () => FormAction | null;
  /** Puts `next` on screen, the words typed in `current` written first. */
  switchTo: (current: CampaignLocale, next: CampaignLocale) => void;
};

export function createDocFlusher(
  dispatch: (action: FormAction) => void,
  timers: Timers = browserTimers,
): DocFlusher {
  let pending: unknown = null;
  let unsaved: { locale: CampaignLocale; read: () => EmailDoc } | null = null;

  const flush = (): FormAction | null => {
    if (pending !== null) timers.clear(pending);
    pending = null;
    const last = unsaved;
    unsaved = null;
    if (!last) return null;
    const action: FormAction = {
      type: "SET_DOC",
      locale: last.locale,
      doc: last.read(),
    };
    dispatch(action);
    return action;
  };

  return {
    typed(locale, read) {
      if (pending !== null) timers.clear(pending);
      unsaved = { locale, read };
      pending = timers.set(flush, DELAY_MS);
    },
    flush,
    switchTo(current, next) {
      if (next === current) return;
      flush();
      dispatch({ type: "SET_LOCALE", locale: next });
    },
  };
}
