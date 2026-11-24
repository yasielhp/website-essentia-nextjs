import {
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";
import { sameTreatment } from "@/lib/treatments/match";
import type { TierSnapshot } from "@/lib/treatments/prices";

/**
 * Which treatments the public site hides, and why: their session type is
 * switched off in Settings.
 *
 * The owner's rule (2026-11-24): a treatment whose session type the centre has
 * switched off is not on the site while it is off. No card on its service's
 * list, no page of its own (404), no line in the sitemap or in the files for
 * assistants. Nothing in code says which: it is read from `service_tiers`, so
 * switching the session type back on brings the treatment back with no deploy.
 *
 * Pure: the snapshot is read by `listHiddenTreatments`.
 */

/** The services whose treatments each have a card and a page of their own. */
export type TreatmentFamily =
  "manual-therapies" | "facial-therapies" | "intravenous-therapy";

export const TREATMENT_FAMILIES: readonly TreatmentFamily[] = [
  "manual-therapies",
  "facial-therapies",
  "intravenous-therapy",
];

/** Whether a value is one of those services. Anything else is asked nothing. */
export function isTreatmentFamily(value: unknown): value is TreatmentFamily {
  return (
    typeof value === "string" &&
    (TREATMENT_FAMILIES as readonly string[]).includes(value)
  );
}

/** The treatments of each family, as `services-data` lists them. */
export const TREATMENTS_OF: Record<
  TreatmentFamily,
  readonly { id: string; title: string }[]
> = {
  "manual-therapies": manualTherapyTreatments,
  "facial-therapies": facialTreatments,
  "intravenous-therapy": ivProtocols,
};

/** The ids of the hidden treatments of each family. */
export type HiddenTreatments = Record<TreatmentFamily, readonly string[]>;

/** Every treatment shown: what a failed read, or no read at all, comes to. */
export const NOTHING_HIDDEN: HiddenTreatments = {
  "manual-therapies": [],
  "facial-therapies": [],
  "intravenous-therapy": [],
};

/**
 * The ids of the treatments to hide: those with a session type switched off
 * and none on sale. A treatment is found by name (`sameTreatment`, which knows
 * its old names too), so:
 *
 * - one with a length still on sale stays (its other length is simply not
 *   priced);
 * - one with no session type at all stays, as it always did: a name nobody
 *   matched is not a decision of the centre's, and hiding on a mismatch would
 *   take a card off the site because a label was edited.
 */
export function hiddenTreatmentIds(
  treatments: readonly { id: string; title: string }[],
  snapshot: Pick<TierSnapshot, "onSale" | "switchedOff">,
): string[] {
  return treatments
    .filter(
      (treatment) =>
        snapshot.switchedOff.some((label) =>
          sameTreatment(label, treatment.title),
        ) &&
        !snapshot.onSale.some((label) => sameTreatment(label, treatment.title)),
    )
    .map((treatment) => treatment.id);
}
