import {
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";

/**
 * Where a session type (a `service_tiers` row) meets a treatment (an entry of
 * `services-data`).
 *
 * Tiers live in the database and carry a label but no description or photo of
 * their own; the treatment copy and pictures live in code. Nothing links them
 * by id: the tier label is the treatment's name, and that is the join.
 *
 * A name can change, and the two sides do not change on the same day: the site
 * is deployed, the label is edited by the centre from the dashboard. So a
 * treatment answers to its title AND to every label it declares in
 * `tierLabels` (the name it had before, a shorter form of the new one). Both
 * resolve to the treatment itself, so the session type finds its treatment
 * before the label is changed and after, and neither order of the two changes
 * breaks the price, the booking link or the bonuses of that treatment.
 */

/**
 * A name as two of them are compared: no regard to case, to the spaces around
 * or between the words, or to which dash separates its halves (`—`, `–`, `-`
 * or `·`), so a label typed in the dashboard with a plain hyphen or a stray
 * capital still finds its page.
 */
function normalise(name: string): string {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s*[—–\-·]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

type Named = { id: string; title: string; tierLabels?: string[] };

/** Every declared name, as normalised, and the treatment it is a name of. */
const TREATMENT_OF = new Map<string, string>();
for (const [family, treatments] of [
  ["manual", manualTherapyTreatments],
  ["facial", facialTreatments],
  ["iv", ivProtocols],
] as [string, Named[]][]) {
  for (const treatment of treatments) {
    for (const name of [treatment.title, ...(treatment.tierLabels ?? [])]) {
      const key = normalise(name);
      // The first to declare a name keeps it; a test makes sure nobody shares.
      if (key && !TREATMENT_OF.has(key)) {
        TREATMENT_OF.set(key, `${family}:${treatment.id}`);
      }
    }
  }
}

/** The treatment a name belongs to, or the name itself when nobody declares it. */
function identity(name: string): string {
  const key = normalise(name);
  return TREATMENT_OF.get(key) ?? `name:${key}`;
}

/**
 * Whether a session type's label and a treatment's title are the same
 * treatment: the same name, or two names of one treatment.
 */
export function sameTreatment(
  tierLabel: string | null | undefined,
  title: string | null | undefined,
): boolean {
  if (!tierLabel || !title) return false;
  if (!normalise(tierLabel) || !normalise(title)) return false;
  return identity(tierLabel) === identity(title);
}

/** The treatment a tier label belongs to, or null. */
export function treatmentForTier<T extends { title: string }>(
  treatments: readonly T[],
  tierLabel: string | null | undefined,
): T | null {
  return treatments.find((t) => sameTreatment(tierLabel, t.title)) ?? null;
}

/**
 * A treatment as it may be handed to the browser: without the labels its
 * session type has carried. They are for the server to find the session type
 * by; a page that was handed them would carry, in its source, a name the
 * treatment no longer has.
 */
export function withoutTierLabels<T extends { tierLabels?: string[] }>(
  treatment: T,
): Omit<T, "tierLabels"> {
  const shown: T = { ...treatment };
  delete shown.tierLabels;
  return shown;
}
