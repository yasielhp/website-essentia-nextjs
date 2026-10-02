import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Next 16.3 appends a generated block to CLAUDE.md on every `dev` run.
  // This file is maintained by hand, so the generation is off and the tree
  // stays clean; flip to `true` to opt back in.
  agentRules: false,
  experimental: {
    // Serves `app/global-not-found.tsx` for unmatched URLs. Without it those
    // fall back to `app/not-found.tsx` inside a generated root layout, which
    // this tree does not have — no stylesheet, no fonts.
    globalNotFound: true,
  },
  // A retired URL, moved permanently so it drops out of the index and passes
  // its equity on. As a page it answered 307 — temporary — which keeps the old
  // URL alive in search results indefinitely.
  async redirects() {
    return [
      {
        source: "/wellness/functional-well-being",
        destination: "/wellness/facial-therapies",
        permanent: true,
      },
      {
        source: "/es/bienestar/functional-well-being",
        destination: "/es/bienestar/terapias-faciales",
        permanent: true,
      },
      // The "leave a review" form is gone — reviews are written on the Google
      // listing now — but the page that held it stayed, so its URL points at
      // the page rather than at nothing.
      { source: "/reviews/new", destination: "/reviews", permanent: true },
      {
        source: "/es/testimonios/nuevo",
        destination: "/es/testimonios",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7642190515d84a34b81f6b11e42e6c44.r2.dev",
      },
      { protocol: "https", hostname: "*.insforge.app" },
      // Reviewer profile pictures from the Google listing. Google serves them
      // from these two hosts and the URLs are opaque, so the pattern cannot be
      // narrower than the host.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "yasiel",

  project: "essentia",

  // Read from the environment: `.env.sentry-build-plugin` locally (gitignored),
  // a Vercel environment variable in CI. Without it the build still succeeds
  // and production stack traces arrive minified.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Build logs only in CI; a local build stays quiet.
  silent: !process.env.CI,

  // Uploads a wider set of source maps, so a stack trace from the browser
  // points at our code rather than at a minified chunk. Costs build time.
  widenClientFileUpload: true,

  // Client reports go through our own origin, so an ad blocker cannot drop
  // them. The route is excluded from the matcher in `proxy.ts` — next-intl has
  // no pathname for it and would answer 404.
  tunnelRoute: "/monitoring",

  webpack: {
    // Off on purpose: our Vercel crons are App Router route handlers
    // (`app/api/cron/*`), which this does not instrument. Cron monitors, if we
    // want them, have to be declared in Sentry by hand.
    automaticVercelMonitors: false,

    treeshake: {
      // Drops Sentry's own debug logging from the client bundle.
      removeDebugLogging: true,
    },
  },
});
