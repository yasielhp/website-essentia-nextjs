import es from "../../../messages/es/dashboard.json";
import type { MessageKey } from "./catalog";

/**
 * What a sender writes where it cannot send because the message is switched
 * off, in Spanish as the booking history is: the name of the message as the
 * list of Messages calls it, and that it is off. Pure.
 */
export function messageName(key: MessageKey): string {
  return (es.messages.keys as Record<string, string>)[key] ?? key;
}

/** The line in a booking's history for an email that was not sent. */
export function emailOffSummary(key: MessageKey): string {
  return `Correo a la clienta no enviado: el mensaje «${messageName(key)}» está apagado`;
}

/** The line for a WhatsApp notice that was not sent. */
export function whatsappOffSummary(key: MessageKey): string {
  return `WhatsApp a la clienta no enviado: el mensaje «${messageName(key)}» está apagado`;
}

/** The marker kept in the entry's `error` column: what a filter or a person can search for. */
export const OFF_REASON = "message_off";
