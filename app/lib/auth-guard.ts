import { publicEnv } from "@/lib/env";
import { getAdminClient } from "@/lib/insforge-admin";
import type { UserRole } from "@/types";

/**
 * Server-side authentication and authorisation.
 *
 * Why a bearer token instead of a cookie: `@insforge/sdk` v1.2.9 keeps the
 * access token **in memory** in the browser and stores the refresh token in an
 * httpOnly cookie scoped to the Insforge backend domain — not to this app's
 * domain. The Next.js server therefore has no ambient way to identify the
 * caller, so privileged Server Actions and Route Handlers receive the caller's
 * access token explicitly and validate it here against Insforge.
 *
 * Server Actions are public HTTP endpoints. Any action that uses the service
 * key MUST call `requireRole()` before touching data.
 */

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type AuthContext = {
  userId: string;
  email: string | null;
  role: UserRole;
};

/** Roles allowed to reach the staff dashboard at all. */
export const DASHBOARD_ROLES: UserRole[] = ["admin", "staff", "partner"];

/** Roles allowed to administer other users, services and settings. */
export const ADMIN_ROLES: UserRole[] = ["admin"];

/**
 * Short-lived cache so a single user action does not trigger two extra network
 * round-trips per call. Bounded at 30s: a role change takes effect within that
 * window, and revoking a session invalidates the token itself upstream.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { expiresAt: number; context: AuthContext }>();

function readCache(token: string): AuthContext | null {
  const hit = cache.get(token);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(token);
    return null;
  }
  return hit.context;
}

function writeCache(token: string, context: AuthContext): void {
  // Keep the map from growing without bound on a long-lived server instance.
  if (cache.size > 500) cache.clear();
  cache.set(token, { expiresAt: Date.now() + CACHE_TTL_MS, context });
}

type SessionResponse = {
  user?: { id?: string; email?: string | null } | null;
};

/**
 * Resolves an access token to a verified user + role.
 * Throws `AuthError` when the token is absent, invalid, or has no profile.
 */
export async function authenticate(
  token: string | null | undefined,
): Promise<AuthContext> {
  if (!token) {
    throw new AuthError("Authentication required", 401);
  }

  const cached = readCache(token);
  if (cached) return cached;

  let session: SessionResponse;
  try {
    const response = await fetch(
      `${publicEnv.insforgeUrl.replace(/\/$/, "")}/api/auth/sessions/current`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new AuthError("Invalid or expired session", 401);
    }
    session = (await response.json()) as SessionResponse;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("Could not verify session", 401);
  }

  const userId = session.user?.id;
  if (!userId) {
    throw new AuthError("Invalid or expired session", 401);
  }

  const { data } = await getAdminClient()
    .database.from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();

  const profile = data as { role: string | null; email: string | null } | null;
  if (!profile?.role) {
    throw new AuthError("No profile associated with this account", 403);
  }

  const context: AuthContext = {
    userId,
    email: profile.email ?? session.user?.email ?? null,
    role: profile.role as UserRole,
  };

  writeCache(token, context);
  return context;
}

/**
 * Authenticates the caller and asserts their role is in `allowed`.
 * Use in Server Actions, which receive the token as an explicit argument.
 */
export async function requireRole(
  token: string | null | undefined,
  allowed: UserRole[] = DASHBOARD_ROLES,
): Promise<AuthContext> {
  const context = await authenticate(token);
  if (!allowed.includes(context.role)) {
    throw new AuthError("Insufficient permissions for this operation", 403);
  }
  return context;
}

/** Extracts the bearer token from an incoming request's Authorization header. */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

/**
 * Route Handler variant: reads the token from the request and asserts the role.
 * Throws `AuthError`; pair with `toAuthErrorResponse()` in a try/catch.
 */
export async function requireApiRole(
  request: Request,
  allowed: UserRole[] = DASHBOARD_ROLES,
): Promise<AuthContext> {
  return requireRole(getBearerToken(request), allowed);
}

/**
 * Maps a thrown error to an HTTP response, without leaking internals.
 * Returns `null` when the error is not an `AuthError`, so callers can rethrow.
 */
export function toAuthErrorResponse(err: unknown): Response | null {
  if (!(err instanceof AuthError)) return null;
  return Response.json({ error: err.message }, { status: err.status });
}
