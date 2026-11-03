import type { MetadataRoute } from "next";
import { contact } from "@/constants/contact";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? `https://${contact.domain}`;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/oauth/",
          "/account/",
          "/api/",
          "/booking/requested",
          "/booking/confirmation",
          "/bonus/",
          "/es/bonus/",
          // The payment page of a bonus, under whichever treatment it is on.
          "/*/bonus/checkout/",
          "/consent/",
          "/es/consentimiento/",
        ],
      },
      { userAgent: "GPTBot", disallow: "/" }, // OpenAI training
      { userAgent: "ChatGPT-User", allow: "/" }, // OpenAI retrieval — permitir
      { userAgent: "ClaudeBot", disallow: "/" }, // Anthropic training
      { userAgent: "anthropic-ai", allow: "/" }, // Anthropic retrieval — permitir
      { userAgent: "PerplexityBot", allow: "/" }, // Perplexity — solo recuperación
      { userAgent: "Googlebot-Extended", disallow: "/" }, // Google AI training
      { userAgent: "cohere-ai", disallow: "/" },
    ],
    sitemap: [`${base}/sitemap-en.xml`, `${base}/sitemap-es.xml`],
  };
}
