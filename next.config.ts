import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7642190515d84a34b81f6b11e42e6c44.r2.dev",
      },
    ],
  },
};

export default nextConfig;
