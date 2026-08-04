"use client";

import { insforge } from "@/lib/insforge";

/**
 * Browser-side access to the current Insforge access token.
 *
 * The SDK keeps the token in memory and exposes it only through the HTTP
 * client's default headers. When no user is signed in, the header falls back to
 * the anon key — harmless, because the server rejects it as a session token.
 *
 * Privileged Server Actions and Route Handlers require this token; see
 * `app/lib/auth-guard.ts` for why it travels explicitly rather than in a cookie.
 */
export function getAccessToken(): string | null {
  try {
    const header = insforge.getHttpClient().getHeaders()["Authorization"];
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice(7) || null;
  } catch {
    return null;
  }
}

/**
 * `fetch` with the caller's access token attached.
 * Use for every request to a route handler guarded by `requireApiRole()`.
 */
export function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
