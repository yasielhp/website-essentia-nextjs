// Sentry in the browser. Loaded on every page load.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

/**
 * Frames that are not ours: a browser extension's script, an injected
 * `<script>` with somebody else's debug id, or an add-in's bootstrap. An
 * event made only of these is not a fault in this site.
 */
const THIRD_PARTY_FRAME =
  /^(<script>|<anonymous>|ext:|<obscura|chrome-extension:|moz-extension:|safari-(web-)?extension:|webkit-masked-url:)/;

function onlyThirdPartyFrames(event: Sentry.ErrorEvent): boolean {
  const frames = event.exception?.values?.flatMap(
    (value) => value.stacktrace?.frames ?? [],
  );
  if (!frames || frames.length === 0) return false;
  return frames.every(
    (frame) => !frame.filename || THIRD_PARTY_FRAME.test(frame.filename),
  );
}

Sentry.init({
  // Public by design, but kept in the environment like every other key here so
  // a local run without it simply reports nothing.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Development is noise: hot reloads, aborted streams, a hydration mismatch
  // from a half-restarted server. Only production reports.
  enabled: process.env.NODE_ENV === "production",

  // Belt and braces over the integration below, which depends on the build
  // plugin having stamped our bundles: an extension's error reached Sentry
  // twice in October with every frame in `<script>` and `ext:core`.
  beforeSend(event) {
    return onlyThirdPartyFrames(event) ? null : event;
  },

  // Session Replay records the browser session. It is on for errors only: the
  // dashboard and the booking form carry client data, and a replay of a sane
  // session is not worth collecting. Masking is explicit rather than implied
  // by the defaults.
  integrations: [
    // Every error this project had received in its first days came from a
    // browser extension (`ext:core/01_core.js`, `<obscura:bootstrap>`) or an
    // Office add-in. Sentry's own browser-extensions inbound filter missed
    // them, so drop anything whose stack is exclusively third-party frames.
    Sentry.thirdPartyErrorFilterIntegration({
      filterKeys: ["essentia-web"],
      behaviour: "drop-error-if-exclusively-contains-third-party-frames",
    }),
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,

  // A Server Action whose fetch is cut off — the visitor navigated away, or
  // lost signal — is not a fault of ours. "Load failed" is Safari's wording,
  // "Failed to fetch" is Chrome's, and the third is the Microsoft Office
  // add-in talking to a page it does not own.
  ignoreErrors: [
    "Load failed",
    "Failed to fetch",
    "NetworkError when attempting to fetch resource",
    /Object Not Found Matching Id/,
  ],

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
