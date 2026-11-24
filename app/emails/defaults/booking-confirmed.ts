import { content, type MessageDefaults } from "./_content";

export const bookingConfirmed: MessageDefaults = {
  es: content(
    "Tu reserva ha sido confirmada — {{service}}",
    "Tu reserva de {{service}} el {{date}} ha sido confirmada.",
    "Reserva confirmada",
    "Tu reserva ha sido confirmada, {{first_name}}.",
    ["Estamos deseando verte. Aquí tienes los detalles de tu próxima sesión."],
    [
      "Para cambiar o cancelar tu cita, escríbenos hasta 24 horas antes de la sesión; si la cancelas, te devolvemos el importe pagado. Dentro de las 24 horas previas, o si no acudes, no hay reembolso.",
    ],
  ),
  en: content(
    "Booking confirmed — {{service}}",
    "Your {{service}} booking on {{date}} is confirmed.",
    "Booking confirmed",
    "Your booking is confirmed, {{first_name}}.",
    [
      "We look forward to seeing you. Here are the details of your upcoming session.",
    ],
    [
      "To change or cancel your appointment, write to us up to 24 hours before the session; if you cancel, we refund what you paid. Within the last 24 hours, or if you do not turn up, there is no refund.",
    ],
  ),
};
