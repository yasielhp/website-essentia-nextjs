/**
 * What the switch of a row and the list's reading of a row decide, over plain
 * values. Every message can be switched off, in the list, one switch per row
 * (message and channel) for all its languages at once; what it saves is the
 * switch only, and saving a text never touches it.
 */

export type Locale = "es" | "en";

/** What the languages of one row say about their switch together. */
export type SwitchSummary = {
  /** `on`: every language; `off`: every language; `partial`: some of them (old data). */
  state: "on" | "off" | "partial";
  /** The languages whose row says it is off, in the row's own order. */
  offLocales: Locale[];
};

export function summarizeSwitch(
  locales: readonly Locale[],
  offLocales: readonly Locale[],
): SwitchSummary {
  const off = locales.filter((l) => offLocales.includes(l));
  return {
    state:
      off.length === 0
        ? "on"
        : off.length === locales.length
          ? "off"
          : "partial",
    offLocales: off,
  };
}

/** What a click on the switch does: a row that is not wholly on is turned on, which equalises the languages; a row that is on is turned off. */
export const switchTarget = (summary: SwitchSummary): boolean =>
  summary.state !== "on";

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

/** Whether a row says its message is switched off. Strictly false: a null or an odd value is not "off". */
export function isSwitchedOff(
  row: { enabled: boolean | null } | null | undefined,
): boolean {
  return Boolean(row && row.enabled === false);
}
