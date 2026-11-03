"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { OAUTH_ROLES } from "@/lib/oauth/core";
import {
  listConnections,
  revokeConnection,
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

/** Disconnects one of the person's own assistants: its tokens stop working at once. */
export async function revokeMcpConnection(
  accessToken: string | null,
  connectionId: string,
): Promise<{ error: "forbidden" | "not_found" | null }> {
  try {
    const { userId } = await requireRole(accessToken, ROLES);
    const revoked = await revokeConnection(userId, connectionId);
    return { error: revoked ? null : "not_found" };
  } catch (err) {
    if (err instanceof AuthError) return { error: "forbidden" };
    throw err;
  }
}
