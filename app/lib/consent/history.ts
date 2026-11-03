/**
 * What a re-signed consent leaves behind.
 *
 * A consent is evidence, so asking a client to sign again must not erase what
 * they signed before. The row keeps only the current state; each time it is
 * reopened or replaced, the state it had is appended to `history` first. The
 * signature file of an earlier state stays in the private bucket, referenced by
 * its path.
 */

/** The columns of a consent row that describe one signing. */
export type ConsentSnapshot = {
  signed_at: string | null;
  signed_name: string | null;
  data: Record<string, boolean | string> | null;
  image_consent: boolean;
  health_data_consent: boolean;
  signature_path: string | null;
  filled_by_role: string | null;
  version: number;
};

/** One earlier signing, as stored in `history`. */
export type ConsentHistoryEntry = Required<
  Omit<ConsentSnapshot, "signed_at">
> & { signed_at: string };

/** The entry for a row's current state, or null when it was never signed. */
export function historyEntryFrom(
  row: ConsentSnapshot,
): ConsentHistoryEntry | null {
  if (!row.signed_at) return null;
  return {
    signed_at: row.signed_at,
    signed_name: row.signed_name,
    data: row.data ?? {},
    image_consent: row.image_consent,
    health_data_consent: row.health_data_consent,
    signature_path: row.signature_path,
    filled_by_role: row.filled_by_role,
    version: row.version,
  };
}

/** `history` with `entry` added at the end; a missing or malformed column counts as empty. */
export function appendHistory(
  history: unknown,
  entry: ConsentHistoryEntry,
): ConsentHistoryEntry[] {
  const previous = Array.isArray(history)
    ? (history as ConsentHistoryEntry[])
    : [];
  return [...previous, entry];
}

export type ConsentState = "none" | "signed" | "reopened";

/**
 * Where a consent stands. `reopened` is a consent that was signed once and has
 * been asked for again: it carries answers but no signature, and counts as not
 * signed until the client signs.
 */
export function consentState(row: {
  signed_at: string | null;
  data: Record<string, unknown> | null;
}): ConsentState {
  if (row.signed_at) return "signed";
  return row.data && Object.keys(row.data).length > 0 ? "reopened" : "none";
}
