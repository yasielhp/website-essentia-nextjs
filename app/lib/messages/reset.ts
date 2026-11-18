import type { MessageKey } from "./catalog";

/** What "restore the default" does to the saved row of one message. */
export type ResetPlan = "none" | "delete" | "clear";

/**
 * Restoring a message's default (or removing its WhatsApp setup) must not undo
 * a decision about whether it is sent. Every message has a switch, so deleting
 * the row of one the admin switched off would switch it back on without a
 * word: there the row stays, emptied, with its switch.
 *
 * - no row: nothing to do.
 * - a row that is switched off: `clear` (keep the row, with its switch).
 * - any other row: `delete`. A row that is on and has no text is the legacy
 *   email, so deleting it is the same thing; a WhatsApp row without a
 *   template sends nothing.
 *
 * The same for both channels and every message. Pure.
 */
export function resetPlan(
  _key: MessageKey,
  _channel: "email" | "whatsapp",
  row: { enabled: boolean } | null,
): ResetPlan {
  if (!row) return "none";
  // Strictly false: a null or an odd value in the column is not "off".
  return row.enabled === false ? "clear" : "delete";
}

/** The columns `clear` empties. The switch is not among them, on purpose. */
export const CLEARED_COLUMNS = {
  subject: null,
  preheader: null,
  title: null,
  doc: null,
  whatsapp_template_id: null,
  whatsapp_params: [] as unknown[],
};
