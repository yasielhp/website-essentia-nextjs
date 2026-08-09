"use server";

import { getAdminClient } from "@/lib/insforge-admin";

export type TierStaff = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
};

/**
 * The people who perform a session type, for the public booking flow.
 *
 * `profiles` is not readable by anonymous visitors and should not become so —
 * it holds emails, phones and calendar tokens. This action runs with the
 * service key and hands back only what the selector shows: a name and a photo.
 */
export async function fetchTierStaff(tierId: string): Promise<TierStaff[]> {
  if (!tierId) return [];

  const db = getAdminClient().database;

  const { data: assigned } = await db
    .from("staff_tiers")
    .select("staff_id, sort_order")
    .eq("tier_id", tierId)
    .order("sort_order");

  const ids = ((assigned ?? []) as { staff_id: string }[]).map(
    (row) => row.staff_id,
  );
  if (ids.length === 0) return [];

  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, first_name, last_name, job_title, avatar_url")
    .in("id", ids)
    .eq("role", "staff")
    .order("full_name");

  // The position is on the assignment, not on the person, so the list is
  // reordered here rather than by the query above.
  const position = new Map(ids.map((id, index) => [id, index]));

  return (
    (people ?? []) as {
      id: string;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      job_title: string | null;
      avatar_url: string | null;
    }[]
  )
    .map((person) => ({
      id: person.id,
      name:
        person.full_name ??
        [person.first_name, person.last_name].filter(Boolean).join(" ") ??
        "",
      jobTitle: person.job_title,
      avatarUrl: person.avatar_url,
    }))
    .sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}
