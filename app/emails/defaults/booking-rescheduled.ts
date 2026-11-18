import { content, type MessageDefaults } from "./_content";

export const bookingRescheduled: MessageDefaults = {
  es: content(
    "Sesión reprogramada — {{service}}",
    "Tu reserva de {{service}} ha sido reprogramada para el {{date}}.",
    "Sesión reprogramada",
    "Tu reserva ha sido reprogramada, {{first_name}}.",
    [
      "Hemos actualizado la fecha y/o la hora de tu sesión. Aquí tienes los nuevos detalles:",
    ],
    [
      "Si esta fecha no te viene bien, llámanos al **+34 634 09 12 95** y estaremos encantados de ayudarte.",
    ],
  ),
  en: content(
    "Booking rescheduled — {{service}}",
    "Your {{service}} booking has been rescheduled to {{date}}.",
    "Booking rescheduled",
    "Your booking has been rescheduled, {{first_name}}.",
    [
      "We have updated the date and/or time of your session. Here are the new details:",
    ],
    [
      "If this date does not work for you, please call us at **+34 634 09 12 95** and we will be happy to help.",
    ],
  ),
};
