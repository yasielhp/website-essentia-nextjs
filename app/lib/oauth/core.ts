import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The rules of the OAuth 2.1 flow that lets ChatGPT and Claude use the MCP
 * server with the centre's own accounts. Pure: no database, no request, so each
 * rule is tested on its own and `server.ts` only has to apply them.
 */

export const SUPPORTED_SCOPES = ["mcp:read", "blog:write"] as const;
export type OAuthScope = (typeof SUPPORTED_SCOPES)[number];

export const CODE_TTL_MS = 5 * 60 * 1000;
export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Who may authorize a connection: the people who work in the dashboard, not partners. */
export const OAUTH_ROLES = ["admin", "staff"] as const;

// ─── Secrets ──────────────────────────────────────────────────

/** What is stored of a code or token: the digest, never the value. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** An unguessable value for a code or token: 32 random bytes, URL-safe. */
export function newSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

// ─── PKCE (RFC 7636, S256 only) ───────────────────────────────

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** A code verifier is 43 to 128 characters of the unreserved set. */
export function isValidVerifier(value: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

/** An S256 challenge is the base64url of a SHA-256 digest: 43 characters, but accept the spec's range. */
export function isValidChallenge(value: string): boolean {
  return /^[A-Za-z0-9\-_]{43,128}$/.test(value);
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!isValidVerifier(verifier)) return false;
  const expected = Buffer.from(pkceChallenge(verifier));
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ─── Redirect URIs ────────────────────────────────────────────

/**
 * Whether a client may register this redirect URI: https, or plain http only
 * for the machine's own loopback (a desktop client listening locally). No
 * custom schemes, no fragments, no credentials in the address.
 */
export function isValidRedirectUri(uri: string): boolean {
  if (typeof uri !== "string" || uri.length === 0 || uri.length > 2000) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") {
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  }
  return false;
}

/** Exact match against the registered list: no prefixes, no case folding, no wildcards. */
export function redirectUriAllowed(
  registered: string[],
  given: string,
): boolean {
  return registered.includes(given);
}

/** `redirectUri` with the response parameters added, keeping any it already has. */
export function authorizationRedirect(
  redirectUri: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

// ─── Scopes ───────────────────────────────────────────────────

/** What a role may be granted. Everything today, kept as a function so it can narrow later. */
export function scopesForRole(role: string | null | undefined): OAuthScope[] {
  return role === "admin" || role === "staff" ? [...SUPPORTED_SCOPES] : [];
}

/**
 * The scopes a connection ends up with: those asked for (all the role allows,
 * when the client asks for none) that this role may actually hold.
 */
export function grantedScopes(
  requested: string | null | undefined,
  role: string | null | undefined,
): OAuthScope[] {
  const allowed = scopesForRole(role);
  const asked = (requested ?? "")
    .split(/\s+/)
    .filter((s): s is OAuthScope =>
      (SUPPORTED_SCOPES as readonly string[]).includes(s),
    );
  if (asked.length === 0) return allowed;
  return allowed.filter((s) => asked.includes(s));
}

// ─── Lifetimes ────────────────────────────────────────────────

export type CodeRow = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: string;
  usedAt: string | null;
};

export type CodeDecision =
  | "ok"
  | "used"
  | "expired"
  | "client_mismatch"
  | "redirect_mismatch"
  | "pkce_failed";

/**
 * Whether an authorization code can be exchanged. The order matters only for
 * the reason given: a code already used is reported as used even if it has also
 * expired, because that is the one worth noticing.
 */
export function codeDecision(
  row: CodeRow,
  now: Date,
  presented: { clientId: string; redirectUri: string; verifier: string },
): CodeDecision {
  if (row.usedAt) return "used";
  if (Date.parse(row.expiresAt) <= now.getTime()) return "expired";
  if (row.clientId !== presented.clientId) return "client_mismatch";
  if (row.redirectUri !== presented.redirectUri) return "redirect_mismatch";
  if (!verifyPkce(presented.verifier, row.codeChallenge)) return "pkce_failed";
  return "ok";
}

export type TokenDecision = "ok" | "expired" | "revoked";

/** An access token is good until it expires or is revoked. */
export function accessDecision(
  row: { expiresAt: string; revokedAt: string | null },
  now: Date,
): TokenDecision {
  if (row.revokedAt) return "revoked";
  return Date.parse(row.expiresAt) <= now.getTime() ? "expired" : "ok";
}

/**
 * A refresh token is single-use: refreshing revokes the row it came from, so a
 * second attempt with the same token finds it revoked and is refused.
 */
export function refreshDecision(
  row: { refreshExpiresAt: string; revokedAt: string | null; clientId: string },
  now: Date,
  clientId: string,
): TokenDecision | "client_mismatch" {
  if (row.revokedAt) return "revoked";
  if (row.clientId !== clientId) return "client_mismatch";
  return Date.parse(row.refreshExpiresAt) <= now.getTime() ? "expired" : "ok";
}

export function expiresIn(ttlMs: number, now: Date): string {
  return new Date(now.getTime() + ttlMs).toISOString();
}
