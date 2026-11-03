import { exchangeCode, refreshTokens } from "@/lib/oauth/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    // A token response must never be cached, by anyone.
    headers: { ...CORS, "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

const fail = (error: string, description?: string) =>
  reply(
    { error, ...(description ? { error_description: description } : {}) },
    400,
  );

/**
 * The token endpoint: an authorization code (with its PKCE verifier) or a
 * refresh token in, a new access token and refresh token out. Public clients
 * only, so there is no client secret to check; the code verifier is what proves
 * the client is the one that started the flow.
 */
export async function POST(req: Request) {
  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await req.text());
  } catch {
    return fail("invalid_request");
  }
  const get = (key: string) => form.get(key) ?? "";

  const grantType = get("grant_type");
  const clientId = get("client_id");
  if (!clientId) return fail("invalid_request", "client_id is required.");

  if (grantType === "authorization_code") {
    const code = get("code");
    const redirectUri = get("redirect_uri");
    const verifier = get("code_verifier");
    if (!code || !redirectUri || !verifier) {
      return fail("invalid_request");
    }
    const result = await exchangeCode({
      code,
      clientId,
      redirectUri,
      codeVerifier: verifier,
    });
    if ("error" in result) {
      return result.error === "server_error"
        ? reply({ error: "server_error" }, 500)
        : fail(result.error);
    }
    return reply(result.tokens, 200);
  }

  if (grantType === "refresh_token") {
    const refreshToken = get("refresh_token");
    if (!refreshToken) return fail("invalid_request");
    const result = await refreshTokens({ refreshToken, clientId });
    if ("error" in result) {
      return result.error === "server_error"
        ? reply({ error: "server_error" }, 500)
        : fail(result.error);
    }
    return reply(result.tokens, 200);
  }

  return fail("unsupported_grant_type");
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
