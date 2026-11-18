import type { MessageVariable } from "./catalog";

/**
 * What each variable stands for, over plain values: the editor draws an icon
 * and a soft colour by kind, so a variable reads the same wherever it is on the
 * page (the bar and the body). Pure and light enough for the browser.
 */

export const VARIABLE_KINDS = [
  "person",
  "service",
  "session",
  "date",
  "time",
  "duration",
  "money",
  "link",
] as const;

export type VariableKind = (typeof VARIABLE_KINDS)[number];

const KIND_OF: Record<MessageVariable, VariableKind> = {
  first_name: "person",
  service: "service",
  session_type: "session",
  date: "date",
  time: "time",
  duration: "duration",
  amount_due: "money",
  amount_paid: "money",
  sessions: "session",
  expires_on: "date",
  cancel_url: "link",
  consent_url: "link",
};

/** The kind of a variable, or null for a name the catalogue does not have. */
export function variableKind(name: string): VariableKind | null {
  return Object.hasOwn(KIND_OF, name) ? KIND_OF[name as MessageVariable] : null;
}
