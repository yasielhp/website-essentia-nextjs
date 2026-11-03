import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyAccessToken } from "@/lib/oauth/server";
import type { ToolServer } from "@/lib/mcp/tool";
import { registerBlogTools } from "./tools/blog";
import { registerBookingTools } from "./tools/bookings";
import { registerServiceTools } from "./tools/services";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.essentiawellnessclub.com";

// ─── MCP handler ──────────────────────────────────────────────
//
// The tools live in `./tools/*`, one file per area, and each is registered
// behind the roles listed for it in `lib/mcp/access.ts`. Online booking from the
// public site is a different thing from `create_booking` here: this one is for
// the centre's own people working through an assistant.

const handler = createMcpHandler(
  (server) => {
    const tools = server as unknown as ToolServer;
    registerServiceTools(tools);
    registerBlogTools(tools);
    registerBookingTools(tools);
  },
  {
    // `basePath` and `maxDuration` were dropped in mcp-handler 2: the handler
    // is served wherever it is mounted, and each request is its own
    // invocation. The route is unchanged — `/api/mcp` — because the
    // `[transport]` segment still supplies the `mcp` part.
    verboseLogs: false,
    serverInfo: { name: "essentia", version: "1.0.0" },
  },
);

// Every request is authenticated with an OAuth access token, which is how
// ChatGPT and Claude connect with "Connect" and no key to copy: without one the
// server answers 401 with a pointer to its protected-resource metadata, and the
// client takes it from there. That includes the read tools. An assistant that
// cannot find a challenge never learns it should ask the person to sign in, so
// leaving them open — `required: false` — would make the connection impossible
// to start.
const authedHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    const verified = await verifyAccessToken(bearerToken);
    if (!verified) return undefined;
    return {
      token: bearerToken,
      clientId: verified.clientId,
      scopes: verified.scopes,
      // The role is the person's *current* one, read with the token: each tool
      // gates on it, so demoting someone narrows their assistants at once.
      extra: { userId: verified.userId, role: verified.role },
    };
  },
  {
    required: true,
    requiredScopes: ["mcp:read"],
    resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
    resourceUrl: siteUrl.replace(/\/$/, ""),
  },
);

export { authedHandler as GET, authedHandler as POST };
