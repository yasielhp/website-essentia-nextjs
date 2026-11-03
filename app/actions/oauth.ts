"use server";

import { getSessionUser } from "@/actions/auth";
import { getAppUrl } from "@/lib/env";
import { checkAuthorizeRequest } from "@/lib/oauth/authorize";
import {
  OAUTH_ROLES,
  authorizationRedirect,
  grantedScopes,
} from "@/lib/oauth/core";
import { getClient, issueCode } from "@/lib/oauth/server";

/** The MCP server's own address: what a token is for, and what `resource` must name. */
function mcpResource(): string {
  return `${getAppUrl().replace(/\/$/, "")}/api/mcp`;
}

/**
 * The person's answer on the consent screen.
 *
 * Everything the screen sent is checked again from scratch: the client is looked
 * up, the redirect address must be one it registered, and the PKCE fields must
 * be well-formed — nothing reaches `redirect_uri` on the screen's say-so. Who is
 * approving comes from the session cookie on the server, never from the request,
 * and only the dashboard roles may approve. Next.js refuses a Server Action
 * called from another origin, so a page on another site cannot press "Allow"
 * for the visitor.
 *
 * Returns the address to send the browser to; the redirect itself is the
 * caller's.
 */
export async function decideAuthorization(input: {
  decision: "allow" | "deny";
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  scope?: string;
  resource?: string | null;
}): Promise<{ url: string | null; error: "invalid" | "forbidden" | null }> {
  const client = await getClient(input.clientId);
  const checked = checkAuthorizeRequest(
    {
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      response_type: "code",
      code_challenge: input.codeChallenge,
      code_challenge_method: "S256",
      state: input.state,
      scope: input.scope,
      resource: input.resource ?? undefined,
    },
    client,
    mcpResource(),
  );
  if (!checked.ok) return { url: null, error: "invalid" };
  const params = checked.params;

  if (input.decision === "deny") {
    return {
      url: authorizationRedirect(params.redirectUri, {
        error: "access_denied",
        state: params.state,
      }),
      error: null,
    };
  }

  const { user, role } = await getSessionUser();
  if (!user || !(OAUTH_ROLES as readonly string[]).includes(role ?? "")) {
    return { url: null, error: "forbidden" };
  }

  const scope = grantedScopes(params.scope, role).join(" ");
  const code = await issueCode({
    clientId: params.clientId,
    userId: user.id,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    scope,
    resource: params.resource,
  });
  if (!code) return { url: null, error: "invalid" };

  return {
    url: authorizationRedirect(params.redirectUri, {
      code,
      state: params.state,
    }),
    error: null,
  };
}
