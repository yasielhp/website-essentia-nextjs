import { formatLongDate } from "@/lib/format-date";
import type { StaffWhatsAppEvent } from "@/lib/whatsapp/types";

/**
 * Builds the parameters of the approved WhatsApp template that tells a member
 * of the team about a booking, in Spanish or in English.
 *
 * Each person is written to in the language of HER account
 * (`profiles.preferred_language`), but English only once Meta has approved the
 * English version of the template: a send in a language the template does not
 * carry fails outright, and a field anyone can change from the dashboard must
 * not be able to cost somebody her notice. That rule is `staffNoticeLanguage`
 * below; with any doubt the notice goes in Spanish, the version that works.
 *
 * The sentences below are **not** website copy and deliberately do not live in
 * `messages/en|es/*.json`: they are part of a template Meta has approved, and
 * the rendered message has to match what was registered. Moving them into the
 * translation files would invite an edit that silently breaks delivery.
 *
 * One parameterised template covers all four events, with one version per
 * language. Its bodies, as registered (`STAFF_TEMPLATE_BODY`):
 *
 *   Hola {{1}}, tienes una actualización sobre una reserva de Essentia Social
 *   Wellness Club. {{2}}. A continuación tienes los detalles de la reserva.
 *   Cliente: {{3}}. Servicio: {{4}}. Cuándo: {{5}}. Puedes consultar todos los
 *   detalles en el botón de abajo.
 *
 *   Hi {{1}}, you have an update on an Essentia Social Wellness Club booking.
 *   {{2}}. Here are the booking details. Client: {{3}}. Service: {{4}}.
 *   When: {{5}}. You can see all the details with the button below.
 *
 * `{{2}}` opens a sentence of its own there, which is why the phrases below
 * start with a capital. Were the template ever edited so that the placeholder
 * sits mid-sentence again, they have to go back to lower case.
 */

export type StaffNoticeLanguage = "es" | "en";

/** The bodies as registered with Meta, word for word. */
export const STAFF_TEMPLATE_BODY: Record<StaffNoticeLanguage, string> = {
  es: "Hola {{1}}, tienes una actualización sobre una reserva de Essentia Social Wellness Club. {{2}}. A continuación tienes los detalles de la reserva. Cliente: {{3}}. Servicio: {{4}}. Cuándo: {{5}}. Puedes consultar todos los detalles en el botón de abajo.",
  en: "Hi {{1}}, you have an update on an Essentia Social Wellness Club booking. {{2}}. Here are the booking details. Client: {{3}}. Service: {{4}}. When: {{5}}. You can see all the details with the button below.",
};

const EVENT_SENTENCE: Record<
  StaffNoticeLanguage,
  Record<StaffWhatsAppEvent, string>
> = {
  es: {
    assigned: "Se te ha asignado una sesión",
    unassigned: "Esta sesión ya no está a tu cargo",
    rescheduled: "Se ha cambiado la hora de una de tus sesiones",
    cancelled: "Se ha cancelado una de tus sesiones",
  },
  en: {
    assigned: "You have been assigned a session",
    unassigned: "This session is no longer assigned to you",
    rescheduled: "The time of one of your sessions has changed",
    cancelled: "One of your sessions has been cancelled",
  },
};

/** What `{{1}}` reads when the person has no name on her account. */
const NO_NAME: Record<StaffNoticeLanguage, string> = {
  es: "hola",
  en: "there",
};

/** Meta's code of the Spanish version, the one that always works. */
export const STAFF_SPANISH_CODE = "es";

/**
 * The language a member of the team is written to in, and Meta's code of the
 * version to send (`en`, `en_US`, `en_GB`…). English when her account says
 * English AND an English version of the template is approved (`approvedCodes`:
 * the languages of the template's APPROVED rows in the local copy); Spanish in
 * every other case, a copy that could not be read included.
 */
export function staffNoticeLanguage(
  preferred: string | null | undefined,
  approvedCodes: readonly string[],
): { language: StaffNoticeLanguage; code: string } {
  const wantsEnglish = (preferred ?? "").trim().toLowerCase().startsWith("en");
  if (wantsEnglish) {
    const english =
      approvedCodes.find((code) => code === "en") ??
      approvedCodes.find((code) => code.startsWith("en_"));
    if (english) return { language: "en", code: english };
  }
  return { language: "es", code: STAFF_SPANISH_CODE };
}

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

export function buildStaffMessage(
  input: StaffMessageInput,
  language: StaffNoticeLanguage = "es",
): StaffMessage {
  const service = input.sessionType
    ? `${input.service} — ${input.sessionType}`
    : input.service;

  const day = formatLongDate(input.date, language);
  const when = [day, input.time].filter(Boolean).join(", ") || "—";

  const params = [
    input.staffFirstName || NO_NAME[language],
    EVENT_SENTENCE[language][input.event],
    input.clientName || "—",
    service || "—",
    when,
  ];

  // The registered body with the parameters in place: this is what the
  // dashboard shows as "the message that went out", and a preview that drifts
  // from the delivered text is worse than no preview at all.
  const bodyPreview = STAFF_TEMPLATE_BODY[language].replace(
    /\{\{(\d)\}\}/g,
    (_, n: string) => params[Number(n) - 1] ?? "",
  );

  // The template's button is `{{app}}/dashboard/bookings/` plus this suffix,
  // so only the id travels as a parameter.
  return { params, bodyPreview, buttonUrlParam: input.bookingId };
}
