import { content, type MessageDefaults } from "./_content";

// The email that follows an online payment. The legacy template has no
// preheader, so the default has none either.
export const bookingPaid: MessageDefaults = {
  es: content(
    "Tu reserva en Essentia está confirmada",
    "",
    "Reserva confirmada",
    "Tu reserva ha sido confirmada, {{first_name}}",
    ["Estamos deseando verte. Aquí tienes los detalles de tu próxima sesión."],
    [
      "Si necesitas cancelar o cambiar la fecha, por favor contáctanos con al menos 24 horas de antelación.",
    ],
  ),
  en: content(
    "Your Essentia booking is confirmed",
    "",
    "Booking Confirmed",
    "Your booking is confirmed, {{first_name}}",
    [
      "We look forward to seeing you. Here are the details of your upcoming session.",
    ],
    [
      "If you need to cancel or reschedule, please contact us at least 24 hours before your session.",
    ],
  ),
};
