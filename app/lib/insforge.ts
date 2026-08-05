import { createBrowserClient } from "@insforge/sdk/ssr";

/**
 * The browser client.
 *
 * It reads the `insforge_access_token` cookie — set on this domain, so Safari
 * and private windows keep it — and refreshes through `/api/auth/refresh` when
 * that token is missing or expired.
 *
 * Its auth surface is read-only by design: `getCurrentUser`, `getProfile` and
 * `getPublicAuthConfig`. Signing in, signing up and signing out run on the
 * server in `app/actions/auth.ts`, because only the server can write the
 * httpOnly refresh cookie.
 */
export const insforge = createBrowserClient();
