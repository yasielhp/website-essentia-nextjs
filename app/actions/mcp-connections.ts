"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { OAUTH_ROLES } from "@/lib/oauth/core";
import {
  listConnections,
  revokeConnections,
  type Connection,
} from "@/lib/oauth/server";
import type { UserRole } from "@/types";

const ROLES = [...OAUTH_ROLES] as UserRole[];

/** The assistants this person has connected to the MCP server. Their own only. */
export async function fetchMcpConnections(
  accessToken: string | null,
): Promise<Connection[]> {
  try {
    const { userId } = await requireRole(accessToken, ROLES);
    return await listConnections(userId);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }
}

/**
 * Disconnects an assistant of the person's own: every connection they hold for
 * it, whose tokens stop working at once. Ids that are not theirs are ignored.
 */
export async function revokeMcpConnections(
  accessToken: string | null,
  connectionIds: string[],
): Promise<{ error: "forbidden" | "not_found" | null }> {
  try {
    const { userId } = await requireRole(accessToken, ROLES);
    const revoked = await revokeConnections(
      userId,
      connectionIds.filter((id) => typeof id === "string").slice(0, 50),
    );
    return { error: revoked > 0 ? null : "not_found" };
  } catch (err) {
    if (err instanceof AuthError) return { error: "forbidden" };
    throw err;
  }
}
