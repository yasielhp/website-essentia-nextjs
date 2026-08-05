import { createClient } from "@insforge/sdk";
import { publicEnv } from "@/lib/env";

/**
 * The anonymous client for public data read on the server.
 *
 * Blog posts, reviews, testimonials, the sitemap and the membership plans
 * belong to nobody: they are the same for every visitor and most of them are
 * prerendered.
 *
 * They need their own client for two reasons. The browser client refreshes
 * through `/api/auth/refresh`, a relative URL with no meaning on the server —
 * it hung the blog prerender until the 60s build timeout. And the server
 * client in `insforge-server.ts` reads `cookies()`, which would turn every one
 * of these pages dynamic.
 *
 * Anything that depends on who is asking wants `createInsForgeServerClient()`
 * instead; anything that must bypass RLS wants `getAdminClient()`.
 */
export const insforgePublic = createClient({
  baseUrl: publicEnv.insforgeUrl,
  anonKey: publicEnv.insforgeAnonKey,
});
