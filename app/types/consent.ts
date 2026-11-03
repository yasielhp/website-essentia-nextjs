/**
 * A contact's consent, as the dashboard reads it. `signedAt` is null when it was
 * reopened for a new signature: the answers are still there to pre-fill from.
 */
export type ContactConsent = {
  signedAt: string | null;
  signedName: string | null;
  imageConsent: boolean;
  healthDataConsent: boolean;
  /** `<id>` booleans, `<id>Detail` strings and `avoidZone`, as the client sent them. */
  answers: Record<string, boolean | string>;
  /** The signature as a data URL; null if the file could not be read. */
  signatureDataUrl: string | null;
  filledByRole: string | null;
};
