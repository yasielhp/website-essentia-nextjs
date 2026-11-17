/**
 * What the reminder's switch and the list's reading of a row decide, over plain
 * values. The reminder is the one email nobody is owed, so it alone can be
 * switched off; the switch lives on its own page and saves at once, and what it
 * saves is the switch only.
 */

/** What saving the switch sends: the switch and the address of the message. */
export function switchInput(
  key: string,
  locale: "es" | "en",
  enabled: boolean,
): { key: string; channel: "email"; locale: "es" | "en"; enabled: boolean } {
  return { key, channel: "email", locale, enabled };
}

type TextFacts = {
  doc?: unknown;
  subject?: string | null;
  preheader?: string | null;
  title?: string | null;
};

/** Whether the row carries any text of its own (a switch alone does not). */
export function rowHasText(row: TextFacts | null | undefined): boolean {
  return Boolean(
    row &&
    (row.doc ||
      (row.subject ?? "").trim() ||
      (row.preheader ?? "").trim() ||
      (row.title ?? "").trim()),
  );
}

/** Whether the message is switched off: it can be, and its row says it is. */
export function isSwitchedOff(
  canDisable: boolean,
  row: { enabled: boolean } | null | undefined,
): boolean {
  return Boolean(canDisable && row && !row.enabled);
}
