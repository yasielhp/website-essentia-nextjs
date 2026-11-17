/**
 * What the contact page says when a save fails. `updateContact` answers with one of
 * three fixed English sentences (never the database's text); the page shows them in
 * the panel's language by matching the exact string. Anything else is the generic
 * failure. A test reads the action's file so the three cannot drift apart.
 */
export const CONTACT_SAVE_PHRASES = {
  invalid: "The contact details are not valid.",
  failed: "The contact could not be saved.",
  emailTaken: "Another contact already has this email address.",
} as const;

export type ContactSaveError = keyof typeof CONTACT_SAVE_PHRASES;

export function contactSaveError(text: string): ContactSaveError {
  for (const [kind, phrase] of Object.entries(CONTACT_SAVE_PHRASES)) {
    if (text === phrase) return kind as ContactSaveError;
  }
  return "failed";
}
