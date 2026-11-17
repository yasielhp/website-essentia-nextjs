import type { KeyboardEvent } from "react";

/**
 * Enter inside a filter modal means "Apply filters".
 *
 * The modals are not `<form>`s on purpose: their "Clear all" and close buttons
 * carry no `type`, so a form would turn them into submit buttons. The dialog
 * listens for the key instead, and this decides whether the key is Enter in a
 * field, as opposed to Enter on a button (which presses it), in a textarea
 * (which writes a new line) or in the middle of an IME composition (which
 * confirms the text).
 */

/** The `<input type>` values where Enter reads as "I am done typing". */
const TEXT_LIKE_INPUTS: ReadonlySet<string> = new Set([
  "",
  "text",
  "search",
  "number",
  "date",
  "datetime-local",
  "email",
  "tel",
  "url",
  "time",
  "month",
  "week",
  "password",
]);

export type FilterKeyInput = {
  key: string;
  /** An IME is composing: this Enter confirms its text. */
  isComposing?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  /** A held-down key repeating. */
  repeat?: boolean;
  /** `event.target.tagName`. */
  targetTag: string;
  /** `event.target.type`, for inputs. */
  targetType?: string | null;
};

export function shouldApplyOnEnter(input: FilterKeyInput): boolean {
  if (input.key !== "Enter") return false;
  if (input.isComposing || input.repeat) return false;
  if (input.shiftKey || input.ctrlKey || input.altKey || input.metaKey) {
    return false;
  }
  const tag = input.targetTag.toLowerCase();
  if (tag === "select") return true;
  if (tag === "input") return TEXT_LIKE_INPUTS.has(input.targetType ?? "");
  return false;
}

/**
 * The `onKeyDown` of a filter dialog: Enter in one of its fields calls
 * `onApply` (which applies the pending filters and closes the modal, like the
 * button) and nothing else happens. Any other key, and Enter anywhere else, is
 * left alone.
 */
export function applyOnEnter(onApply: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement & { type?: string };
    const native = e.nativeEvent as { isComposing?: boolean; keyCode?: number };
    const apply = shouldApplyOnEnter({
      key: e.key,
      // Safari reports the Enter that ends a composition with `keyCode` 229
      // and `isComposing` already false.
      isComposing: native.isComposing === true || native.keyCode === 229,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      repeat: e.repeat,
      targetTag: target.tagName ?? "",
      targetType: target.type,
    });
    if (!apply) return;
    e.preventDefault();
    onApply();
  };
}
