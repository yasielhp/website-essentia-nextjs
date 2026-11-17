import type { WhatsAppParamField } from "@/lib/whatsapp/types";
import {
  MESSAGE_CATALOG,
  type MessageKey,
  type MessageVariable,
} from "./catalog";

/**
 * Which `{{n}}` of a WhatsApp template a message variable can fill.
 *
 * A message offers variables (`catalog.ts`); a WhatsApp template's parameters
 * are filled from `WhatsAppParamField`s, the set the campaigns already use. A
 * variable with no entry here (`duration`, the amounts, the links…) has no
 * field and so cannot feed a parameter: the admin can still type it as fixed
 * text, but the sender has nothing to read it from.
 */
export const VARIABLE_PARAM_FIELD: Partial<
  Record<MessageVariable, WhatsAppParamField>
> = {
  first_name: "first_name",
  service: "service",
  session_type: "session_type",
  date: "date",
  time: "time",
};

/** The parameter fields a message may use: its variables that have one. */
export function allowedParamFields(key: MessageKey): WhatsAppParamField[] {
  const fields: WhatsAppParamField[] = [];
  for (const variable of MESSAGE_CATALOG[key].variables) {
    const field = VARIABLE_PARAM_FIELD[variable];
    if (field) fields.push(field);
  }
  return fields;
}
