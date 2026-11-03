/**
 * Where a session type (a `service_tiers` row) meets a treatment (an entry of
 * `services-data`).
 *
 * Tiers live in the database and carry a label but no description or photo of
 * their own; the treatment copy and pictures live in code. Nothing links them
 * by id: the tier label is set to the treatment's title, and that is the join.
 * Compared without regard to case or surrounding spaces, so a label typed in
 * the dashboard with a stray capital still finds its page.
 */
export function sameTreatment(
  tierLabel: string | null | undefined,
  title: string | null | undefined,
): boolean {
  if (!tierLabel || !title) return false;
  return tierLabel.trim().toLowerCase() === title.trim().toLowerCase();
}

/** The treatment a tier label belongs to, or null. */
export function treatmentForTier<T extends { title: string }>(
  treatments: readonly T[],
  tierLabel: string | null | undefined,
): T | null {
  return treatments.find((t) => sameTreatment(tierLabel, t.title)) ?? null;
}
