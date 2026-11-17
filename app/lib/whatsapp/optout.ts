/**
 * Inbound opt-outs: which text is one, and which contacts it belongs to.
 *
 * Both are pure so the webhook only does the reading and the writing.
 */

import { toE164 } from "@/lib/whatsapp/client";

/**
 * The only words that unsubscribe. `CANCELAR` is left out on purpose: a client
 * who writes it almost always means her appointment, and dropping her from
 * WhatsApp in silence would be the wrong answer to that message.
 */
const OPT_OUT_WORDS: ReadonlySet<string> = new Set(["stop", "baja"]);

/**
 * True when the whole message is an opt-out word. Case, accents, surrounding
 * spaces and punctuation around the word are ignored (`"Stop."`, `" baja! "`),
 * but a sentence that merely contains it (`"no quiero parar"`) is not one.
 */
export function isOptOutText(text: string | null | undefined): boolean {
  if (!text) return false;
  const word = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // Leading and trailing spaces and punctuation, `¡`/`¿` included.
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return OPT_OUT_WORDS.has(word);
}

/**
 * The ids of the contacts whose phone is the sender's number.
 *
 * Phones are stored however a form wrote them (`600 11 22 33`, `600-112-233`,
 * `0034600112233`), so SQL cannot match them reliably; each is normalised with
 * `toE164` and compared here. `from` is Meta's `messages[].from`, digits only
 * and without the `+`; a sender that is not a usable number matches nothing.
 */
export function matchOptOut(
  from: string,
  contacts: { id: string; phone: string | null }[],
): string[] {
  const digits = from.replace(/\D/g, "");
  if (!digits) return [];
  // Always with the `+`, so `toE164` never adds the Spanish prefix to it.
  const sender = toE164(`+${digits}`);
  if (!sender) return [];
  return contacts
    .filter((contact) => toE164(contact.phone) === sender)
    .map((contact) => contact.id);
}
