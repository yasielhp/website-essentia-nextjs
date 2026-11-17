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

function clean(value: string | null | undefined): string {
  const flat = (value ?? "").replace(/\s+/g, " ").trim();
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
