/**
 * The rule of the exact opt-out word, pure and free of imports so that a client
 * component can read it (the template form warns about a button that will not
 * unsubscribe) without pulling the Meta client or the contact matching into the
 * browser. `optout.ts` re-exports `isOptOutText`; nothing else changes.
 */

/**
 * The only words that unsubscribe. `CANCELAR` is left out on purpose: a client
 * who writes it almost always means her appointment, and dropping her from
 * WhatsApp in silence would be the wrong answer to that message.
 */
const OPT_OUT_WORDS: ReadonlySet<string> = new Set(["stop", "baja"]);

/** Longer than any opt-out word plus the punctuation a person would add. */
const MAX_OPT_OUT_LENGTH = 20;

/**
 * True when the whole message is an opt-out word. Case, accents, surrounding
 * spaces and punctuation around the word are ignored (`"Stop."`, `" baja! "`),
 * but a sentence that merely contains it (`"no quiero parar"`) is not one.
 *
 * Takes `unknown` because the text comes from a webhook body: a number or an
 * object where Meta promises a string must read as "not an opt-out", not throw.
 */
export function isOptOutText(text: unknown): boolean {
  if (typeof text !== "string") return false;
  // A long text is never a bare opt-out word; skip normalising it.
  if (text.length > MAX_OPT_OUT_LENGTH) return false;
  const word = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // Leading and trailing spaces and punctuation, `¡`/`¿` included.
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return OPT_OUT_WORDS.has(word);
}
