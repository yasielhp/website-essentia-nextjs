import { createClient } from "@insforge/sdk";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Admin (service-key) Insforge client — bypasses RLS.
 *
 * SERVER ONLY. Never import this from a Client Component: it reads
 * `INSFORGE_SERVICE_KEY`, which has no `NEXT_PUBLIC_` prefix, so any client
 * bundle that reaches it would break the build rather than leak the key.
 *
 * Replaces 18 hand-rolled copies of `getAdminClient()` that were scattered
 * across actions and route handlers. The instance is memoised per server
 * runtime, so we no longer allocate a new HTTP client on every request.
 */

let cached: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (!cached) {
    cached = createClient({
      baseUrl: publicEnv.insforgeUrl,
      anonKey: serverEnv.insforgeServiceKey,
      isServerMode: true,
    });
  }
  return cached;
}
