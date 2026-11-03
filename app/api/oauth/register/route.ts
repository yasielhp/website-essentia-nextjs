import { z } from "zod";
import { isValidRedirectUri } from "@/lib/oauth/core";
import { registerClient } from "@/lib/oauth/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

const bodySchema = z.object({
  client_name: z.string().trim().min(1).max(100).optional(),
  redirect_uris: z.array(z.string().max(2000)).min(1).max(10),
});

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": "no-store" },
  });
}

/**
 * Dynamic Client Registration (RFC 7591).
 *
 * Public by design: ChatGPT and Claude register themselves the first time
 * someone connects, so there is no client to authenticate yet. What keeps it
 * harmless is that a registration grants nothing — a client still needs a person
 * to sign in and approve it — and that only safe redirect addresses are
 * accepted: https, or the machine's own loopback. Public clients only: no
 * secret is issued.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return reply({ error: "invalid_client_metadata" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success || !parsed.data.redirect_uris.every(isValidRedirectUri)) {
    return reply(
      {
        error: "invalid_redirect_uri",
        error_description:
          "redirect_uris must be https addresses, or http on localhost.",
      },
      400,
    );
  }

  const client = await registerClient({
    clientName: parsed.data.client_name ?? "MCP client",
    redirectUris: [...new Set(parsed.data.redirect_uris)],
  });
  if (!client) return reply({ error: "server_error" }, 500);

  return reply(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    201,
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
