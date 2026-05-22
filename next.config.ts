import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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
