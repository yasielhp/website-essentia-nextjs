import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Next 16.3 appends a generated block to CLAUDE.md on every `dev` run.
  // This file is maintained by hand, so the generation is off and the tree
  // stays clean; flip to `true` to opt back in.
  agentRules: false,
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
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7642190515d84a34b81f6b11e42e6c44.r2.dev",
      },
      { protocol: "https", hostname: "*.insforge.app" },
    ],
  },
};

export default withNextIntl(nextConfig);
