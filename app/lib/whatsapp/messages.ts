import { formatLongDate } from "@/lib/format-date";
import type { StaffWhatsAppEvent } from "@/lib/whatsapp/types";

/**
 * Builds the parameters of the approved WhatsApp template.
 *
 * The four sentences below are **not** website copy and deliberately do not
 * live in `messages/en|es/*.json`: they are part of a template Meta has
 * approved, and the rendered message has to match what was registered. Moving
 * them into the translation files would invite an edit that silently breaks
 * delivery.
 *
 * The template is a single parameterised one — one approval covers all four
 * events:
 *
 *   Hola {{1}}, {{2}}. Cliente: {{3}}. Servicio: {{4}}. Cuándo: {{5}}.
 */

const EVENT_SENTENCE: Record<StaffWhatsAppEvent, { es: string; en: string }> = {
  assigned: {
    es: "se te ha asignado una sesión",
    en: "a session has been assigned to you",
  },
  unassigned: {
    es: "esta sesión ya no está a tu cargo",
    en: "this session is no longer yours",
  },
  rescheduled: {
    es: "se ha cambiado la hora de una de tus sesiones",
    en: "one of your sessions has been moved",
  },
  cancelled: {
    es: "se ha cancelado una de tus sesiones",
    en: "one of your sessions has been cancelled",
  },
};

export type StaffMessageInput = {
  event: StaffWhatsAppEvent;
  language: "es" | "en";
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
  const { language } = input;

  const sentence = EVENT_SENTENCE[input.event][language];
  const service = input.sessionType
    ? `${input.service} — ${input.sessionType}`
    : input.service;

  const day = formatLongDate(input.date, language);
  const when = [day, input.time].filter(Boolean).join(", ") || "—";

  const params = [
    input.staffFirstName || (language === "es" ? "hola" : "there"),
    sentence,
    input.clientName || "—",
    service || "—",
    when,
  ];

  const bodyPreview =
    language === "es"
      ? `Hola ${params[0]}, ${params[1]}. Cliente: ${params[2]}. Servicio: ${params[3]}. Cuándo: ${params[4]}.`
      : `Hi ${params[0]}, ${params[1]}. Client: ${params[2]}. Service: ${params[3]}. When: ${params[4]}.`;

  // The template's button is `{{app}}/dashboard/bookings/` plus this suffix,
  // so only the id travels as a parameter.
  return { params, bodyPreview, buttonUrlParam: input.bookingId };
}
