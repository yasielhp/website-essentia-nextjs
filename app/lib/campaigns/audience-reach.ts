/**
 * What the audience preview answered, as the form needs it: a reach, or the fact
 * that it could not be calculated. A failure used to be turned into a count of
 * zero, which let the admin confirm an audience on the strength of "nobody"
 * when the truth was "unknown". Pure, so a test can pin the two apart.
 */
export type Reach = { count: number; en: number; es: number };
export type ReachOutcome = { ok: true; reach: Reach } | { ok: false };

export function reachOutcome(result: unknown): ReachOutcome {
  if (typeof result !== "object" || result === null) return { ok: false };
  const { count, byLanguage } = result as {
    count?: unknown;
    byLanguage?: { en?: unknown; es?: unknown } | null;
  };
  if (
    typeof count !== "number" ||
    typeof byLanguage?.en !== "number" ||
    typeof byLanguage?.es !== "number"
  ) {
    return { ok: false };
  }
  return { ok: true, reach: { count, en: byLanguage.en, es: byLanguage.es } };
}
