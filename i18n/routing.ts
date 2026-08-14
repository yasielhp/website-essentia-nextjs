import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es"] as const,
  defaultLocale: "en",
  localePrefix: "as-needed",
  pathnames: {
    "/": "/",

    // Top-level translated routes
    "/about": { en: "/about", es: "/nosotros" },
    "/contact": { en: "/contact", es: "/contacto" },
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/shop": { en: "/shop", es: "/tienda" },
    "/booking": { en: "/booking", es: "/reserva" },
    "/booking/cancel": { en: "/booking/cancel", es: "/reserva/cancelar" },

    // Wellness
    "/wellness": { en: "/wellness", es: "/bienestar" },
    "/wellness/contrast-therapy": {
      en: "/wellness/contrast-therapy",
      es: "/bienestar/terapia-de-contraste",
    },
    "/wellness/red-light-therapy": {
      en: "/wellness/red-light-therapy",
      es: "/bienestar/terapia-de-luz-roja",
    },
    "/wellness/breathing-sessions": {
      en: "/wellness/breathing-sessions",
      es: "/bienestar/sesiones-de-respiracion",
    },
    "/wellness/manual-therapies": {
      en: "/wellness/manual-therapies",
      es: "/bienestar/terapias-manuales",
    },
    "/wellness/facial-therapies": {
      en: "/wellness/facial-therapies",
      es: "/bienestar/terapias-faciales",
    },
    "/wellness/functional-wellbeing": {
      en: "/wellness/functional-wellbeing",
      es: "/bienestar/bienestar-funcional",
    },
    "/wellness/facial-therapies/[slug]": {
      en: "/wellness/facial-therapies/[slug]",
      es: "/bienestar/terapias-faciales/[slug]",
    },
    "/wellness/manual-therapies/[slug]": {
      en: "/wellness/manual-therapies/[slug]",
      es: "/bienestar/terapias-manuales/[slug]",
    },

    // Medicine
    "/medicine": { en: "/medicine", es: "/medicina" },
    "/medicine/hyperbaric-chambers": {
      en: "/medicine/hyperbaric-chambers",
      es: "/medicina/camaras-hiperbaricas",
    },
    "/medicine/intravenous-therapy": {
      en: "/medicine/intravenous-therapy",
      es: "/medicina/terapia-intravenosa",
    },
    "/medicine/intravenous-therapy/[slug]": {
      en: "/medicine/intravenous-therapy/[slug]",
      es: "/medicina/terapia-intravenosa/[slug]",
    },
    "/medicine/regenerative-medicine": {
      en: "/medicine/regenerative-medicine",
      es: "/medicina/medicina-regenerativa",
    },

    // Experiences
    "/experiences": { en: "/experiences", es: "/experiencias" },
    "/experiences/memberships": {
      en: "/experiences/memberships",
      es: "/experiencias/membresias",
    },
    "/experiences/running-club": {
      en: "/experiences/running-club",
      es: "/experiencias/running-club",
    },
    "/experiences/running-club/register": {
      en: "/experiences/running-club/register",
      es: "/experiencias/running-club/inscripcion",
    },
    "/experiences/education-programs": {
      en: "/experiences/education-programs",
      es: "/experiencias/programas-educativos",
    },
    "/experiences/education-programs/register": {
      en: "/experiences/education-programs/register",
      es: "/experiencias/programas-educativos/inscripcion",
    },

    // Reviews
    "/reviews": { en: "/reviews", es: "/testimonios" },

    // Untranslated routes (same in both locales)
    "/privacy": "/privacy",
    "/terms": "/terms",
    "/cookies": "/cookies",
    "/legal": "/legal",
    "/sign-in": "/sign-in",
    "/sign-up": "/sign-up",
    "/forgot-password": "/forgot-password",
    "/reset-password": "/reset-password",
    "/booking/confirmation": "/booking/confirmation",
    "/booking/requested": "/booking/requested",
    "/newsletter/unsubscribe": "/newsletter/unsubscribe",
  },
});
