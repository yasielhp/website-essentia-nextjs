/** A contact's signed consent, as the dashboard reads it. */
export type ContactConsent = {
  signedAt: string;
  signedName: string | null;
  imageConsent: boolean;
  healthDataConsent: boolean;
  /** `<id>` booleans, `<id>Detail` strings and `avoidZone`, as the client sent them. */
  answers: Record<string, boolean | string>;
  /** The signature as a data URL; null if the file could not be read. */
  signatureDataUrl: string | null;
  filledByRole: string | null;
};
