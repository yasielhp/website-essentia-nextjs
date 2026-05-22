import type { MetadataRoute } from "next";
import { contact } from "@/constants/contact";

export default function robots(): MetadataRoute.Robots {
  const base = `https://${contact.domain}`;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/account/",
        "/api/",
        "/booking/requested",
        "/booking/confirmation",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
