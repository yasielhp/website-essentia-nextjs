import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import type { AuthContext } from "@/lib/auth-guard";
import {
  DESK_CONTACT_COLUMNS,
  toDeskOption,
  type DeskContactOption,
  type DeskContactRow,
} from "./desk-consents";

/**
 * The contacts the desk's "New booking" offers when the client is looked up
 * by name, email or phone. SERVER ONLY (service key).
 *
 * Who sees whom is the rule of the contact pages (`contactAccess`): admin and
 * staff every contact, a partner only the clients of her own bookings. Only
 * contacts with an email are offered: the booking is linked to its contact by
 * the address (`linkDeskContact`). Each comes with its two consents read the
 * way the desk's switches need them (`desk-consents.ts`).
 */

export const DESK_SEARCH_LIMIT = 8;

const querySchema = z.string().trim().min(2).max(80);

/** The words of a search, without what PostgREST's filter grammar reads. */
export function searchTerms(query: string): string[] {
  return query
    .replace(/[,()*\\%_.:+]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
}

export type DeskSearchResult =
  | { ok: true; contacts: DeskContactOption[] }
  | { ok: false; error: "invalid" | "failed" };

export async function searchDeskContactsCore(
  actor: Pick<AuthContext, "role" | "userId">,
  raw: unknown,
): Promise<DeskSearchResult> {
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const terms = searchTerms(parsed.data);
  if (terms.length === 0) return { ok: true, contacts: [] };

  try {
    const db = getAdminClient().database;

    // A partner: only the clients of her own bookings.
    let onlyIds: string[] | null = null;
    if (actor.role !== "admin" && actor.role !== "staff") {
      if (actor.role !== "partner") return { ok: true, contacts: [] };
      const { data, error } = await db
        .from("bookings")
        .select("contact_id")
        .eq("partner_id", actor.userId)
        .not("contact_id", "is", null)
        .limit(2000);
      if (error) return { ok: false, error: "failed" };
      onlyIds = [
        ...new Set(
          ((data ?? []) as { contact_id: string | null }[])
            .map((row) => row.contact_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (onlyIds.length === 0) return { ok: true, contacts: [] };
    }

    let query = db
      .from("contacts")
      .select(DESK_CONTACT_COLUMNS)
      .not("email", "is", null);
    if (onlyIds) query = query.in("id", onlyIds);
    // One `or` per word, so "Ana García" finds a first name AND a last name.
    for (const term of terms) {
      query = query.or(
        `email.ilike.*${term}*,first_name.ilike.*${term}*,last_name.ilike.*${term}*,phone.ilike.*${term}*`,
      );
    }
    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(DESK_SEARCH_LIMIT);
    if (error) return { ok: false, error: "failed" };
    return {
      ok: true,
      contacts: ((data ?? []) as DeskContactRow[])
        .map(toDeskOption)
        .filter((option): option is DeskContactOption => option !== null),
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}
