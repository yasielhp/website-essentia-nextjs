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
    "/wellness/functional-well-being": {
      en: "/wellness/functional-well-being",
      es: "/bienestar/bienestar-funcional",
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
    "/medicine/regenerative-medicine": {
      en: "/medicine/regenerative-medicine",
      es: "/medicina/medicina-regenerativa",
    },

    // Community
    "/community": { en: "/community", es: "/comunidad" },
    "/community/memberships": {
      en: "/community/memberships",
      es: "/comunidad/membresias",
    },
    "/community/running-club": {
      en: "/community/running-club",
      es: "/comunidad/running-club",
    },
    "/community/education-programs": {
      en: "/community/education-programs",
      es: "/comunidad/programas-educativos",
    },

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
