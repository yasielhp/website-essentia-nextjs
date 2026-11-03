/**
 * Which signature a consent submission ends up with, and whether the form may
 * be sent. Pure, so the two ends of the wire apply the same rules.
 *
 * A first signing, and the public link, need a signature drawn now. Correcting
 * a consent that is already signed (`replace`) does not: the signature on file
 * stands unless a new one is drawn, because the person correcting an answer at
 * the desk is not asking the client to sign twice.
 */

export type SignatureSource =
  /** A signature was drawn in this submission: store it. */
  | { use: "new" }
  /** Keep the file already on record; nothing is uploaded. */
  | { use: "keep" }
  /** There is nothing to sign with. */
  | { use: "none" };

export function signatureSource(
  mode: "first" | "replace",
  drewNew: boolean,
  previousPath: string | null,
): SignatureSource {
  if (drewNew) return { use: "new" };
  if (mode === "replace" && previousPath) return { use: "keep" };
  return { use: "none" };
}

/**
 * Whether the form can be submitted. Every answer, the treatment and the
 * health-data switches are always required. The signature is required too,
 * unless the consent is being corrected and one is already on record.
 */
export function canSubmitConsent(state: {
  allAnswered: boolean;
  treatmentAccepted: boolean;
  healthDataAccepted: boolean;
  drewSignature: boolean;
  replacing: boolean;
  hasPreviousSignature: boolean;
}): boolean {
  if (!state.allAnswered) return false;
  if (!state.treatmentAccepted || !state.healthDataAccepted) return false;
  if (state.drewSignature) return true;
  return state.replacing && state.hasPreviousSignature;
}
