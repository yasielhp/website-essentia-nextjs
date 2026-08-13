import { formatLongDate } from "@/lib/format-date";
import type { StaffWhatsAppEvent } from "@/lib/whatsapp/types";

/**
 * Builds the parameters of the approved WhatsApp template.
 *
 * **Spanish only, on purpose.** Only the Spanish template is registered with
 * Meta, and a send in a language the template does not carry fails outright.
 * Deriving the language from `profiles.preferred_language` would make that
 * failure depend on a field anyone can change from the dashboard, so the
 * language is fixed here instead — see `WHATSAPP_TEMPLATE_LANGUAGE`. Adding
 * English again means registering the English body with Meta *first*.
 *
 * The four sentences below are **not** website copy and deliberately do not
 * live in `messages/en|es/*.json`: they are part of a template Meta has
 * approved, and the rendered message has to match what was registered. Moving
 * them into the translation files would invite an edit that silently breaks
 * delivery.
 *
 * One parameterised template covers all four events. Its body, as registered:
 *
 *   Hola {{1}}, tienes una actualización sobre una reserva de Essentia Social
 *   Wellness Club. {{2}}. A continuación tienes los detalles de la reserva.
 *   Cliente: {{3}}. Servicio: {{4}}. Cuándo: {{5}}. Puedes consultar todos los
 *   detalles en el botón de abajo.
 *
 * `{{2}}` opens a sentence of its own there, which is why the four phrases
 * below start with a capital. Were the template ever edited so that the
 * placeholder sits mid-sentence again, they have to go back to lower case.
 */

const EVENT_SENTENCE: Record<StaffWhatsAppEvent, string> = {
  assigned: "Se te ha asignado una sesión",
  unassigned: "Esta sesión ya no está a tu cargo",
  rescheduled: "Se ha cambiado la hora de una de tus sesiones",
  cancelled: "Se ha cancelado una de tus sesiones",
};

export type StaffMessageInput = {
  event: StaffWhatsAppEvent;
  staffFirstName: string;
  clientName: string;
  service: string;
  sessionType?: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  /** HH:MM */
  time: string | null;
  bookingId: string;
};

export type StaffMessage = {
  params: string[];
  bodyPreview: string;
  buttonUrlParam: string;
};

export function buildStaffMessage(input: StaffMessageInput): StaffMessage {
  const service = input.sessionType
    ? `${input.service} — ${input.sessionType}`
    : input.service;

  const day = formatLongDate(input.date, "es");
  const when = [day, input.time].filter(Boolean).join(", ") || "—";

  const params = [
    input.staffFirstName || "hola",
    EVENT_SENTENCE[input.event],
    input.clientName || "—",
    service || "—",
    when,
  ];

  // Kept word for word in step with the approved template: this is what the
  // dashboard shows as "the message that went out", and a preview that drifts
  // from the delivered text is worse than no preview at all.
  const bodyPreview = `Hola ${params[0]}, tienes una actualización sobre una reserva de Essentia Social Wellness Club. ${params[1]}. A continuación tienes los detalles de la reserva. Cliente: ${params[2]}. Servicio: ${params[3]}. Cuándo: ${params[4]}. Puedes consultar todos los detalles en el botón de abajo.`;

  // The template's button is `{{app}}/dashboard/bookings/` plus this suffix,
  // so only the id travels as a parameter.
  return { params, bodyPreview, buttonUrlParam: input.bookingId };
}
