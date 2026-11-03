import {
  isValidChallenge,
  isValidRedirectUri,
  redirectUriAllowed,
} from "./core";

/**
 * Checking an authorization request (RFC 6749 §4.1.1 with PKCE, RFC 8707).
 *
 * The one rule that shapes everything: until the client and its redirect address
 * are known to be genuine, no error may be sent *to* that address — it would
 * turn this endpoint into a way to bounce a person to any site. So a bad
 * `client_id` or `redirect_uri` is a `fatal` error shown here, and everything
 * else is a `redirect` error handed back to the client, as the spec says.
 */

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state: string | undefined;
  codeChallenge: string;
  scope: string;
  resource: string | null;
};

export type AuthorizeCheck =
  | { ok: true; params: AuthorizeParams }
  | { ok: false; kind: "fatal" }
  | {
      ok: false;
      kind: "redirect";
      redirectUri: string;
      state: string | undefined;
      error: string;
      description: string;
    };

export function checkAuthorizeRequest(
  raw: Record<string, string | undefined>,
  client: { clientId: string; redirectUris: string[] } | null,
  expectedResource: string,
): AuthorizeCheck {
  const redirectUri = raw.redirect_uri ?? "";
  if (
    !client ||
    client.clientId !== raw.client_id ||
    !isValidRedirectUri(redirectUri) ||
    !redirectUriAllowed(client.redirectUris, redirectUri)
  ) {
    return { ok: false, kind: "fatal" };
  }

  const state = raw.state && raw.state.length <= 512 ? raw.state : undefined;
  const refuse = (error: string, description: string): AuthorizeCheck => ({
    ok: false,
    kind: "redirect",
    redirectUri,
    state,
    error,
    description,
  });

  if (raw.response_type !== "code") {
    return refuse(
      "unsupported_response_type",
      "Only response_type=code is supported.",
    );
  }
  if (raw.code_challenge_method !== "S256") {
    return refuse(
      "invalid_request",
      "PKCE with code_challenge_method=S256 is required.",
    );
  }
  if (!raw.code_challenge || !isValidChallenge(raw.code_challenge)) {
    return refuse("invalid_request", "A valid code_challenge is required.");
  }
  // A client that names the resource it wants a token for must name this one.
  if (raw.resource && raw.resource.replace(/\/$/, "") !== expectedResource) {
    return refuse("invalid_target", "Unknown resource.");
  }

  return {
    ok: true,
    params: {
      clientId: client.clientId,
      redirectUri,
      state,
      codeChallenge: raw.code_challenge,
      scope: (raw.scope ?? "").slice(0, 200),
      resource: raw.resource ? raw.resource.replace(/\/$/, "") : null,
    },
  };
}
