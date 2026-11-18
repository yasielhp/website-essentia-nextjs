import { content, type MessageDefaults } from "./_content";

export const bookingReceived: MessageDefaults = {
  es: content(
    "Solicitud de reserva recibida — {{service}}",
    "Hemos recibido tu solicitud de reserva para {{service}} el {{date}}.",
    "Solicitud recibida",
    "Gracias, {{first_name}}. Hemos recibido tu solicitud.",
    [
      "Estamos revisando tu solicitud y confirmaremos tu reserva en breve. Si tienes alguna pregunta, no dudes en contactarnos.",
    ],
    [
      "Si necesitas cancelar o modificar tu solicitud, por favor contáctanos con al menos 24 horas de antelación.",
    ],
  ),
  en: content(
    "Booking request received — {{service}}",
    "We have received your booking request for {{service}} on {{date}}.",
    "Request received",
    "Thank you, {{first_name}}. We have received your request.",
    [
      "We are reviewing your request and will confirm your booking shortly. If you have any questions, feel free to contact us.",
    ],
    [
      "If you need to cancel or modify your request, please contact us at least 24 hours in advance.",
    ],
  ),
};
