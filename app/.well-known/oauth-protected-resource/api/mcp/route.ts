import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { getAppUrl } from "@/lib/env";

/**
 * OAuth Protected Resource Metadata (RFC 9728): says that the MCP server at
 * `/api/mcp` is protected, and by which authorization server. The same document
 * is served at the bare path and at the one suffixed with the resource's own,
 * because clients ask for either.
 */
const origin = getAppUrl().replace(/\/$/, "");

const handler = protectedResourceHandler({
  authServerUrls: [origin],
  resourceUrl: `${origin}/api/mcp`,
});

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
