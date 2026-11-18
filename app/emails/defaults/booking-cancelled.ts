import { content, type MessageDefaults } from "./_content";

export const bookingCancelled: MessageDefaults = {
  es: content(
    "Reserva cancelada — {{service}}",
    "Tu reserva de {{service}} el {{date}} ha sido cancelada.",
    "Reserva cancelada",
    "Tu reserva ha sido cancelada, {{first_name}}.",
    [
      "Tu reserva ha sido cancelada. Si crees que es un error o deseas hacer una nueva reserva, por favor contáctanos.",
    ],
    [
      "Para reprogramar tu sesión o resolver cualquier duda, llámanos al **+34 634 09 12 95** con al menos 24 horas de antelación. Esperamos verte pronto.",
    ],
  ),
  en: content(
    "Booking cancelled — {{service}}",
    "Your {{service}} booking on {{date}} has been cancelled.",
    "Booking cancelled",
    "Your booking has been cancelled, {{first_name}}.",
    [
      "Your booking has been cancelled. If you believe this is a mistake or would like to make a new reservation, please contact us.",
    ],
    [
      "To reschedule or for any enquiries, please call us at **+34 634 09 12 95** at least 24 hours in advance. We hope to welcome you soon.",
    ],
  ),
};
