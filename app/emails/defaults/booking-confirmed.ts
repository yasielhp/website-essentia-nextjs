import { content, type MessageDefaults } from "./_content";

export const bookingConfirmed: MessageDefaults = {
  es: content(
    "Tu reserva ha sido confirmada — {{service}}",
    "Tu reserva de {{service}} el {{date}} ha sido confirmada.",
    "Tu reserva ha sido confirmada, {{first_name}}.",
    [
      "Reserva confirmada",
      "Estamos deseando verte. Aquí tienes los detalles de tu próxima sesión.",
    ],
    [
      "Si necesitas cancelar o cambiar la fecha, por favor contáctanos con al menos 24 horas de antelación.",
    ],
  ),
  en: content(
    "Booking confirmed — {{service}}",
    "Your {{service}} booking on {{date}} is confirmed.",
    "Your booking is confirmed, {{first_name}}.",
    [
      "Booking confirmed",
      "We look forward to seeing you. Here are the details of your upcoming session.",
    ],
    [
      "If you need to cancel or reschedule, please contact us at least 24 hours before your session.",
    ],
  ),
};
