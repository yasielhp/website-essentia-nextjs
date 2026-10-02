// Sentry in the browser. Loaded on every page load.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Public by design, but kept in the environment like every other key here so
  // a local run without it simply reports nothing.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Session Replay records the browser session. It is on for errors only: the
  // dashboard and the booking form carry client data, and a replay of a sane
  // session is not worth collecting. Masking is explicit rather than implied
  // by the defaults.
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,

  // Everything in development, a tenth of it in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  dataCollection: {
    // To stop sending user data and HTTP bodies, uncomment these. See
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
