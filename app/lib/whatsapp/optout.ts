/**
 * Inbound opt-outs: which text is one, and which contacts it belongs to.
 *
 * Both are pure so the webhook only does the reading and the writing.
 */

import { toE164 } from "@/lib/whatsapp/client";
import { matchByPhone } from "@/lib/whatsapp/match";

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

/** `value[key]` when `value` is an object, else undefined. Never throws. */
function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/**
 * True when an inbound message is an opt-out, typed or PRESSED.
 *
 * A client does not always type the word. Meta delivers the three ways of
 * saying it as three message types:
 *
 *  - `text`: what she typed, in `text.body`.
 *  - `button`: a quick-reply button of a TEMPLATE, with the button's label in
 *    `button.text` and the payload the business set for it in `button.payload`.
 *  - `interactive`: a reply button or a list row of an interactive message,
 *    with its label in `interactive.button_reply.title` or
 *    `interactive.list_reply.title`.
 *
 * Every one of them goes through `isOptOutText`, so the rule is the same exact
 * word everywhere: a button labelled "Darme de baja" or "Cancelar" is not a
 * STOP. Each type reads its own fields and nothing else. Takes `unknown` for
 * the same reason `isOptOutText` does.
 */
export function isOptOutMessage(message: unknown): boolean {
  switch (field(message, "type")) {
    case "text":
      return isOptOutText(field(field(message, "text"), "body"));
    case "button": {
      const button = field(message, "button");
      return (
        isOptOutText(field(button, "text")) ||
        isOptOutText(field(button, "payload"))
      );
    }
    case "interactive": {
      const interactive = field(message, "interactive");
      return (
        isOptOutText(field(field(interactive, "button_reply"), "title")) ||
        isOptOutText(field(field(interactive, "list_reply"), "title"))
      );
    }
    default:
      return false;
  }
}

/**
 * The ids of the contacts whose phone is one of the senders' numbers, compared
 * with `toE164` (see `matchByPhone`). `from` is Meta's `messages[].from`.
 */
export function matchOptOut(
  from: string | readonly string[],
  contacts: { id: string; phone: string | null }[],
): string[] {
  return matchByPhone(from, contacts, toE164);
}
