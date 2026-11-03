import { z } from "zod";
import {
  TOOL_ACCESS,
  roleAllowed,
  type McpRole,
  type ToolName,
} from "./access";

/**
 * The plumbing every MCP tool shares: reading who is calling, refusing the
 * wrong role, and answering in one shape.
 */

export type AuthInfo = {
  scopes: string[];
  extra?: { userId?: string; role?: string };
};

/**
 * What the SDK hands a tool. The authorization that `withMcpAuth` verified
 * arrives under `http.authInfo` with the SDK this project resolves; older ones
 * put it at the top. Both are read, so an upgrade cannot silently lock every
 * connection out again.
 */
export type ToolExtra = {
  authInfo?: AuthInfo;
  http?: { authInfo?: AuthInfo };
};

export const authOf = (extra: ToolExtra): AuthInfo | undefined =>
  extra.authInfo ?? extra.http?.authInfo;

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: true;
};

export const text = (value: string, isError = false): ToolResult => ({
  content: [{ type: "text" as const, text: value }],
  ...(isError ? { isError: true as const } : {}),
});

/** Compact JSON, which is what an assistant reads best and what costs the fewest tokens. */
export const json = (value: unknown): ToolResult => text(JSON.stringify(value));

export const fail = (message: string): ToolResult => text(message, true);

/** The caller, once the role has been checked. */
export type ToolAuth = {
  userId: string | null;
  role: McpRole;
  scopes: string[];
};

/** Null when the caller's role is on the list; otherwise the refusal to return. */
export function denyUnless(
  extra: ToolExtra,
  roles: readonly McpRole[],
): ToolResult | null {
  const role = authOf(extra)?.extra?.role;
  return roleAllowed(role, roles)
    ? null
    : fail("Forbidden: your Essentia account is not allowed to use this tool.");
}

const WRITE_SCOPE = "blog:write";

/** Writes also need the scope the connection was granted, on top of the role. */
export function writeDenied(extra: ToolExtra): ToolResult | null {
  return authOf(extra)?.scopes.includes(WRITE_SCOPE)
    ? null
    : fail(
        "Unauthorized: this connection cannot write. Reconnect the server from your assistant and allow access when asked.",
      );
}

/** The slice of the SDK's server that tools need, so they can be tested with a fake. */
export type ToolServer = {
  registerTool: (
    name: string,
    config: { title: string; description: string; inputSchema: z.ZodRawShape },
    callback: (args: never, extra: never) => unknown,
  ) => unknown;
};

/**
 * Registers a tool behind its role.
 *
 * The roles come from `TOOL_ACCESS`, by name, so a tool cannot be added without
 * saying who may use it. `needsWrite` also demands the write scope. A handler
 * that throws answers with a plain error instead of taking the request down,
 * and what it throws is never echoed: it could carry a query or a name.
 */
export function defineTool<S extends z.ZodRawShape>(
  server: ToolServer,
  name: ToolName,
  config: {
    title: string;
    description: string;
    inputSchema?: S;
    needsWrite?: boolean;
  },
  handler: (
    args: z.infer<z.ZodObject<S>>,
    auth: ToolAuth,
  ) => Promise<ToolResult> | ToolResult,
): void {
  const roles = TOOL_ACCESS[name];
  server.registerTool(
    name,
    {
      title: config.title,
      description: config.description,
      inputSchema: (config.inputSchema ?? {}) as z.ZodRawShape,
    },
    (async (args: z.infer<z.ZodObject<S>>, extra: ToolExtra) => {
      const denied =
        denyUnless(extra, roles) ??
        (config.needsWrite ? writeDenied(extra) : null);
      if (denied) return denied;

      const info = authOf(extra)!;
      try {
        return await handler(args, {
          userId: info.extra?.userId ?? null,
          role: info.extra!.role as McpRole,
          scopes: info.scopes,
        });
      } catch (err) {
        console.error(
          `[mcp] ${name} failed:`,
          err instanceof Error ? err.name : "error",
        );
        return fail(
          "Something went wrong. Try again, or ask a person to look.",
        );
      }
    }) as never,
  );
}
