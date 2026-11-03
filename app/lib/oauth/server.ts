import { getAdminClient } from "@/lib/insforge-admin";
import {
  ACCESS_TTL_MS,
  CODE_TTL_MS,
  REFRESH_TTL_MS,
  accessDecision,
  codeDecision,
  expiresIn,
  grantedScopes,
  newSecret,
  refreshDecision,
  sha256Hex,
} from "./core";

/**
 * SERVER ONLY. The database side of the OAuth flow.
 *
 * Every table here is closed to everything but the service key, and codes and
 * tokens are kept as SHA-256 digests: what is stored cannot be used to get in.
 * Nothing in this file logs a code, a token, an address or a name.
 */

const db = () => getAdminClient().database;

export type OAuthClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
};

// ─── Clients ──────────────────────────────────────────────────

export async function registerClient(input: {
  clientName: string;
  redirectUris: string[];
}): Promise<OAuthClient | null> {
  const clientId = newSecret(18);
  const { error } = await db()
    .from("oauth_clients")
    .insert([
      {
        client_id: clientId,
        client_name: input.clientName,
        redirect_uris: input.redirectUris,
        token_endpoint_auth_method: "none",
      },
    ]);
  if (error) return null;
  return {
    clientId,
    clientName: input.clientName,
    redirectUris: input.redirectUris,
  };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 100) return null;
  const { data } = await db()
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  const row = data as {
    client_id: string;
    client_name: string;
    redirect_uris: unknown;
  } | null;
  if (!row || !Array.isArray(row.redirect_uris)) return null;
  return {
    clientId: row.client_id,
    clientName: row.client_name,
    redirectUris: row.redirect_uris.filter(
      (u): u is string => typeof u === "string",
    ),
  };
}

// ─── Codes ────────────────────────────────────────────────────

/** Stores a single-use code for five minutes and returns its value, the only time it exists in the clear. */
export async function issueCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string | null;
}): Promise<string | null> {
  const code = newSecret();
  const { error } = await db()
    .from("oauth_codes")
    .insert([
      {
        code_hash: sha256Hex(code),
        client_id: input.clientId,
        user_id: input.userId,
        redirect_uri: input.redirectUri,
        code_challenge: input.codeChallenge,
        code_challenge_method: "S256",
        scope: input.scope,
        resource: input.resource,
        expires_at: expiresIn(CODE_TTL_MS, new Date()),
      },
    ]);
  return error ? null : code;
}

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type OAuthError =
  "invalid_grant" | "invalid_client" | "invalid_request" | "server_error";

/** Creates an access token and its refresh token and returns their values once. */
async function issueTokens(input: {
  clientId: string;
  userId: string;
  scope: string;
}): Promise<TokenResponse | null> {
  const now = new Date();
  const access = newSecret();
  const refresh = newSecret();
  const { error } = await db()
    .from("oauth_tokens")
    .insert([
      {
        token_hash: sha256Hex(access),
        refresh_hash: sha256Hex(refresh),
        client_id: input.clientId,
        user_id: input.userId,
        scope: input.scope,
        expires_at: expiresIn(ACCESS_TTL_MS, now),
        refresh_expires_at: expiresIn(REFRESH_TTL_MS, now),
      },
    ]);
  if (error) return null;
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refresh,
    scope: input.scope,
  };
}

/**
 * Trades an authorization code for tokens.
 *
 * Marking the code used is a single conditional UPDATE, so of two requests
 * presenting the same code only one gets a row back and only one gets tokens.
 */
export async function exchangeCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ tokens: TokenResponse } | { error: OAuthError }> {
  const hash = sha256Hex(input.code);
  const { data } = await db()
    .from("oauth_codes")
    .select(
      "client_id, user_id, redirect_uri, code_challenge, scope, expires_at, used_at",
    )
    .eq("code_hash", hash)
    .maybeSingle();
  const row = data as {
    client_id: string;
    user_id: string;
    redirect_uri: string;
    code_challenge: string;
    scope: string;
    expires_at: string;
    used_at: string | null;
  } | null;
  if (!row) return { error: "invalid_grant" };

  const decision = codeDecision(
    {
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      codeChallenge: row.code_challenge,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
    },
    new Date(),
    {
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      verifier: input.codeVerifier,
    },
  );
  if (decision !== "ok") return { error: "invalid_grant" };

  const { data: claimed } = await db()
    .from("oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hash)
    .is("used_at", null)
    .select("code_hash");
  if (((claimed ?? []) as unknown[]).length === 0) {
    return { error: "invalid_grant" };
  }

  const tokens = await issueTokens({
    clientId: row.client_id,
    userId: row.user_id,
    scope: row.scope,
  });
  return tokens ? { tokens } : { error: "server_error" };
}

/**
 * Trades a refresh token for a new pair and revokes the old one. The revoke is
 * a conditional UPDATE, so the same refresh token cannot be spent twice.
 */
export async function refreshTokens(input: {
  refreshToken: string;
  clientId: string;
}): Promise<{ tokens: TokenResponse } | { error: OAuthError }> {
  const hash = sha256Hex(input.refreshToken);
  const { data } = await db()
    .from("oauth_tokens")
    .select("client_id, user_id, scope, refresh_expires_at, revoked_at")
    .eq("refresh_hash", hash)
    .maybeSingle();
  const row = data as {
    client_id: string;
    user_id: string;
    scope: string;
    refresh_expires_at: string;
    revoked_at: string | null;
  } | null;
  if (!row) return { error: "invalid_grant" };

  const decision = refreshDecision(
    {
      refreshExpiresAt: row.refresh_expires_at,
      revokedAt: row.revoked_at,
      clientId: row.client_id,
    },
    new Date(),
    input.clientId,
  );
  if (decision !== "ok") return { error: "invalid_grant" };

  const { data: revoked } = await db()
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("refresh_hash", hash)
    .is("revoked_at", null)
    .select("id");
  if (((revoked ?? []) as unknown[]).length === 0) {
    return { error: "invalid_grant" };
  }

  const tokens = await issueTokens({
    clientId: row.client_id,
    userId: row.user_id,
    scope: row.scope,
  });
  return tokens ? { tokens } : { error: "server_error" };
}

// ─── Using a token ────────────────────────────────────────────

export type VerifiedToken = {
  clientId: string;
  userId: string;
  scopes: string[];
};

/**
 * Resolves a bearer token to who it acts for and what it may do, or null.
 *
 * The scopes are the intersection of what the token was granted and what the
 * person's role allows *now*: demote someone, or take their role away, and
 * their connections lose the power at once, without waiting for them to expire.
 */
export async function verifyAccessToken(
  token: string,
): Promise<VerifiedToken | null> {
  const hash = sha256Hex(token);
  const { data } = await db()
    .from("oauth_tokens")
    .select("client_id, user_id, scope, expires_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  const row = data as {
    client_id: string;
    user_id: string;
    scope: string;
    expires_at: string;
    revoked_at: string | null;
  } | null;
  if (!row) return null;
  if (
    accessDecision(
      { expiresAt: row.expires_at, revokedAt: row.revoked_at },
      new Date(),
    ) !== "ok"
  ) {
    return null;
  }

  const { data: profile } = await db()
    .from("profiles")
    .select("role")
    .eq("id", row.user_id)
    .maybeSingle();
  const role = (profile as { role: string | null } | null)?.role ?? null;
  const scopes = grantedScopes(row.scope, role);
  if (scopes.length === 0) return null;

  // Bookkeeping that nobody waits for.
  void db()
    .from("oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hash)
    .then(() => undefined);

  return { clientId: row.client_id, userId: row.user_id, scopes };
}

// ─── Connections, for the account page ────────────────────────

export type Connection = {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** The person's live connections: refreshable and not revoked. */
export async function listConnections(userId: string): Promise<Connection[]> {
  const { data } = await db()
    .from("oauth_tokens")
    .select(
      "id, client_id, created_at, last_used_at, refresh_expires_at, oauth_clients(client_name)",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("refresh_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (
    (data ?? []) as unknown as {
      id: string;
      created_at: string;
      last_used_at: string | null;
      oauth_clients: { client_name: string } | null;
    }[]
  ).map((r) => ({
    id: r.id,
    clientName: r.oauth_clients?.client_name ?? "—",
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

/**
 * Revokes some of the person's connections: each one's access token and, with
 * it, its refresh. Only rows that are theirs are touched, whatever ids arrive.
 */
export async function revokeConnections(
  userId: string,
  connectionIds: string[],
): Promise<number> {
  if (connectionIds.length === 0) return 0;
  const { data } = await db()
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .in("id", connectionIds)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id");
  return ((data ?? []) as unknown[]).length;
}
