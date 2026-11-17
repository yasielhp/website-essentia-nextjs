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

/**
 * The ids of the contacts whose phone is one of the senders' numbers.
 *
 * Phones are stored however a form wrote them (`600 11 22 33`, `600-112-233`,
 * `0034600112233`), so SQL cannot match them reliably; each is normalised with
 * `toE164` and compared here. A sender is Meta's `messages[].from`, digits only
 * and without the `+`; one that is not a usable number matches nothing. Contacts
 * are indexed by number once, so any number of senders costs a single pass.
 */
export function matchOptOut(
  from: string | readonly string[],
  contacts: { id: string; phone: string | null }[],
): string[] {
  const byPhone = new Map<string, string[]>();
  for (const contact of contacts) {
    const phone = toE164(contact.phone);
    if (!phone) continue;
    const ids = byPhone.get(phone);
    if (ids) ids.push(contact.id);
    else byPhone.set(phone, [contact.id]);
  }

  const matched = new Set<string>();
  for (const sender of typeof from === "string" ? [from] : from) {
    if (typeof sender !== "string") continue;
    const digits = sender.replace(/\D/g, "");
    if (!digits) continue;
    // Always with the `+`, so `toE164` never adds the Spanish prefix to it.
    const phone = toE164(`+${digits}`);
    for (const id of (phone && byPhone.get(phone)) || []) matched.add(id);
  }
  return [...matched];
}
