import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";

/**
 * The per-request client for Server Components, Server Actions and Route
 * Handlers.
 *
 * It reads the access-token cookie and sends it as the bearer token for that
 * request. The refresh token stays server-owned and is never handed to it.
 *
 * For admin work that must not run as the caller, use `getAdminClient()` in
 * `app/lib/insforge-admin.ts` instead.
 */
export async function createInsForgeServerClient() {
  return createServerClient({ cookies: await cookies() });
}
