import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import type { Recipient } from "./audience-filter";

/**
 * What a recipient's template parameters are, as the strings Meta receives.
 *
 * Meta rejects the whole message (error 132018) when a text parameter is
 * empty, holds a newline or a tab, or has more than four spaces in a row, so
 * every value is flattened to single spaces and an empty one becomes a dash.
 * The limit is below the 1024 characters Meta allows for the whole body, to
 * leave room for the template's own text.
 */

export const MAX_PARAM_LENGTH = 1000;
const EMPTY = "—";

// Zero-width characters and the byte order mark: invisible, so a value made of
// them would pass for text and reach Meta as an empty parameter.
const INVISIBLE = /[\u200B-\u200D\uFEFF]/g;
const CONTROL = /\p{Cc}/gu;

/**
 * Takes `unknown` on purpose: `vars` and the recipient come out of jsonb
 * columns, and a number or a null stored there must not throw and abort the
 * whole send.
 */
function clean(value: unknown): string {
  const flat = String(value ?? "")
    .replace(INVISIBLE, "")
    // Whitespace (newlines, tabs, NBSP, U+2028…) becomes a space before the
    // remaining control characters are deleted, so "a\nb" stays two words.
    .replace(/\s+/g, " ")
    .replace(CONTROL, "")
    .replace(/\s+/g, " ")
    .trim();
  // Counted in characters, not UTF-16 units, so an emoji is never cut in two.
  const cut = Array.from(flat).slice(0, MAX_PARAM_LENGTH).join("").trimEnd();
  return cut === "" ? EMPTY : cut;
}

/**
 * `vars` carries what only the rule knows (`service`, `session_type`, `date`,
 * `time`, `post_title`, `post_url`); a key it did not set reads as empty.
 */
export function resolveParams(
  sources: WhatsAppParamSource[],
  recipient: Recipient,
  vars: Record<string, string> = {},
): string[] {
  return sources.map((source) => {
    if (source.kind === "static") return clean(source.value);
    switch (source.field) {
      case "first_name":
        return clean(recipient.firstName);
      case "last_name":
        return clean(recipient.lastName);
      default:
        return clean(
          Object.hasOwn(vars, source.field) ? vars[source.field] : "",
        );
    }
  });
}

/**
 * Null when the sources fill the template's `{{n}}` exactly; otherwise the
 * code the save validation and the send report. A mismatch makes Meta refuse
 * every message, so it is caught before one is sent.
 */
export function paramsMatchTemplate(
  sources: WhatsAppParamSource[],
  paramCount: number,
): "paramCountMismatch" | null {
  return sources.length === paramCount ? null : "paramCountMismatch";
}
