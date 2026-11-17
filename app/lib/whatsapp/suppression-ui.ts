/**
 * What the contact card paints about the STOP list.
 *
 * Only a number that is on the list is worth a line. Everything else paints
 * nothing, on purpose: the list lives in a table that a migration creates, so
 * until it is applied the read fails, and a card that shows an error (or
 * breaks) for a thing the admin cannot act on helps nobody. The same goes for
 * an answer that has not come yet.
 */
export type SuppressionLookup =
  | { ok: true; suppressed: boolean }
  | { ok: false; error: string }
  | null
  | undefined;

export function suppressionView(
  lookup: SuppressionLookup,
): "listed" | "hidden" {
  return typeof lookup === "object" &&
    lookup !== null &&
    lookup.ok === true &&
    lookup.suppressed === true
    ? "listed"
    : "hidden";
}
