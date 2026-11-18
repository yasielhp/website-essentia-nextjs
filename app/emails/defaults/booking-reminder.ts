import { content, type MessageDefaults } from "./_content";

// The reminder goes out in Spanish only today (the cron fixes the locale), so
// the legacy code has no English subject. The English one below is the single
// default text with no legacy source: a plain rendering of the Spanish subject.
export const bookingReminder: MessageDefaults = {
  es: content(
    "Tu sesión del {{date}} — {{service}}",
    "Tu sesión de {{service}} es el {{date}} a las {{time}}.",
    "Tu próxima sesión",
    "Te esperamos pronto, {{first_name}}.",
    [
      "Un recordatorio de tu cita. Ven con ropa cómoda y, si puedes, llega cinco minutos antes.",
    ],
  ),
  en: content(
    "Your session on {{date}} — {{service}}",
    "Your {{service}} session is on {{date}} at {{time}}.",
    "Your next session",
    "See you soon, {{first_name}}.",
    [
      "A reminder of your appointment. Wear something comfortable and, if you can, arrive five minutes early.",
    ],
  ),
};
