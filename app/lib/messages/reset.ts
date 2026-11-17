import { MESSAGE_CATALOG, type MessageKey } from "./catalog";

/** What "restore the default" does to the saved row of one message. */
export type ResetPlan = "none" | "delete" | "clear";

/**
 * Restoring a message's default must not undo a decision about whether it is
 * sent. Deleting the row of a reminder the admin switched off would switch it
 * back on without a word, so there the row stays, emptied, with its switch.
 *
 * - no row: nothing to do.
 * - an email message that can be switched off, and is: `clear` (keep the row).
 * - everything else: `delete`. A row that is on and has no text is the legacy
 *   email, so deleting it is the same thing; a message that cannot be switched
 *   off has no switch worth keeping; a WhatsApp row is only a choice of
 *   template, and without a row nothing is sent.
 *
 * Pure.
 */
/**
 * Whether this row carries a switch a reset must not undo: the email of a
 * message that can be switched off. Pure.
 */
export function keepsSwitch(
  key: MessageKey,
  channel: "email" | "whatsapp",
): boolean {
  return channel === "email" && MESSAGE_CATALOG[key].canDisable;
}

export function resetPlan(
  key: MessageKey,
  channel: "email" | "whatsapp",
  row: { enabled: boolean } | null,
): ResetPlan {
  if (!row) return "none";
  if (keepsSwitch(key, channel)) {
    // Strictly false: a null or an odd value in the column is not "off".
    return row.enabled === false ? "clear" : "delete";
  }
  return "delete";
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
