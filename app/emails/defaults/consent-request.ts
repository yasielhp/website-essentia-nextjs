import { content, type MessageDefaults } from "./_content";

// The legacy template has no kicker line above the title.
export const consentRequest: MessageDefaults = {
  es: content(
    "Completa tu consentimiento informado · Essentia",
    "Completa tu consentimiento informado antes de tu sesión.",
    null,
    "Hola, {{first_name}}",
    [
      "Para poder atenderte con seguridad necesitamos que completes tu consentimiento informado. Solo lo haces una vez.",
    ],
  ),
  en: content(
    "Complete your informed consent · Essentia",
    "Please complete your informed consent before your session.",
    null,
    "Hello, {{first_name}}",
    [
      "To look after you safely we need you to complete your informed consent. You only do it once.",
    ],
  ),
};
