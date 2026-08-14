"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, requireRole } from "@/lib/auth-guard";
import type {
  BookingEventActorRole,
  BookingEventChannel,
  BookingEventName,
  BookingEventRow,
  BookingEventStatus,
} from "@/lib/booking-events/types";

/**
 * The history of one booking, newest first.
 *
 * Read through the service key rather than the browser client because
 * `booking_events` holds staff phone numbers and client addresses: only the
 * dashboard, and only with a staff role, gets to see them.
 */
export async function fetchBookingEvents(
  accessToken: string | null,
  bookingId: string,
): Promise<BookingEventRow[]> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }

  if (!bookingId) return [];

  const db = getAdminClient().database;

  const { data } = await db
    .from("booking_events")
    .select(
      "id, channel, event, actor_id, actor_role, recipient_id, recipient, status, error, summary, created_at, delivered_at, read_at",
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as {
    id: string;
    channel: string;
    event: string;
    actor_id: string | null;
    actor_role: string | null;
    recipient_id: string | null;
    recipient: string | null;
    status: string;
    error: string | null;
    summary: string;
    created_at: string;
    delivered_at: string | null;
    read_at: string | null;
  }[];

  // Resolved in one round trip rather than joined: both columns point at
  // `auth.users`, not at `profiles`, so there is no relation for the SDK to
  // follow. Actors and recipients are looked up together — they are the same
  // handful of people.
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.actor_id) ids.add(row.actor_id);
    if (row.recipient_id) ids.add(row.recipient_id);
  }

  const names = new Map<string, string>();
  if (ids.size > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, first_name, full_name")
      .in("id", [...ids]);

    for (const profile of (profiles ?? []) as {
      id: string;
      first_name: string | null;
      full_name: string | null;
    }[]) {
      const name = profile.full_name?.trim() || profile.first_name?.trim();
      if (name) names.set(profile.id, name);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    channel: row.channel as BookingEventChannel,
    event: row.event as BookingEventName,
    actorName: row.actor_id ? (names.get(row.actor_id) ?? null) : null,
    actorRole: row.actor_role as BookingEventActorRole | null,
    recipientName: row.recipient_id
      ? (names.get(row.recipient_id) ?? null)
      : null,
    recipient: row.recipient,
    status: row.status as BookingEventStatus,
    error: row.error,
    summary: row.summary,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
  }));
}
