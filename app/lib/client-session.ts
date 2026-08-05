"use client";

/**
 * Browser-side access to the current Insforge access token.
 *
 * The token lives in the `insforge_access_token` cookie, set by this app on
 * its own domain and deliberately readable by scripts — the refresh token is
 * the httpOnly one. Reading it here rather than from the SDK's memory means it
 * survives a full page load, which is what happens whenever the browser moves
 * between the public site, the account and the dashboard: they are separate
 * root layouts.
 *
 * Privileged Server Actions and Route Handlers require this token; see
 * `app/lib/auth-guard.ts` for why it travels explicitly.
 */
const ACCESS_TOKEN_COOKIE = "insforge_access_token";

export function getAccessToken(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${ACCESS_TOKEN_COOKIE}=([^;]*)`),
  );
  if (!match) return null;

  return decodeURIComponent(match[1]) || null;
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
