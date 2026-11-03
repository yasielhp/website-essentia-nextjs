import { getAppUrl } from "@/lib/env";
import { SUPPORTED_SCOPES } from "@/lib/oauth/core";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 *
 * What ChatGPT and Claude read first to learn where to send the person to sign
 * in, where to exchange the code and where to register themselves. Public and
 * open to any origin on purpose: it is a description, not a door.
 */
export function GET() {
  const issuer = getAppUrl().replace(/\/$/, "");
  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [...SUPPORTED_SCOPES],
    },
    { headers: { ...CORS, "Cache-Control": "max-age=3600" } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
