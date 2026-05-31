import type { MetadataRoute } from "next";
import { contact } from "@/constants/contact";

export default function robots(): MetadataRoute.Robots {
  const base = `https://${contact.domain}`;
  return {
    rules: [
      {
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
      { userAgent: "GPTBot", disallow: "/" }, // OpenAI training
      { userAgent: "ChatGPT-User", allow: "/" }, // OpenAI retrieval — permitir
      { userAgent: "ClaudeBot", disallow: "/" }, // Anthropic training
      { userAgent: "anthropic-ai", allow: "/" }, // Anthropic retrieval — permitir
      { userAgent: "PerplexityBot", allow: "/" }, // Perplexity — solo recuperación
      { userAgent: "Googlebot-Extended", disallow: "/" }, // Google AI training
      { userAgent: "cohere-ai", disallow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
