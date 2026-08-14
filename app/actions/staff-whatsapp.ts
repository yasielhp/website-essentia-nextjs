"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { notifyStaffOnWhatsApp } from "@/lib/whatsapp/notify";
import type {
  StaffWhatsAppEvent,
  WhatsAppMessageRow,
} from "@/lib/whatsapp/types";

/**
 * Dashboard entry point for the staff WhatsApp notifications.
 *
 * The booking pages are Client Components, so they need an action to reach the
 * server; that action is a public endpoint, hence the role check. The
 * unauthenticated flows — the public booking form and the cancellation link —
 * import `notifyStaffOnWhatsApp` on the server instead, which is why the type
 * lives in `lib/whatsapp/types` and is not re-exported from here: a type export
 * on a `"use server"` module compiles and then fails at runtime.
 */
export async function notifyStaffWhatsApp(
  accessToken: string | null,
  input: { bookingId: string; staffId: string; event: StaffWhatsAppEvent },
): Promise<void> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    // Silent by design: the caller has already saved the booking and shows its
    // own errors. An unauthorised caller simply gets nothing sent.
    if (err instanceof AuthError) return;
    throw err;
  }

  await notifyStaffOnWhatsApp(input);
}

/**
 * The WhatsApp notifications recorded against one booking, newest first.
 *
 * Read through the service key rather than the browser client because
 * `whatsapp_messages` holds staff phone numbers: only the dashboard, and only
 * with a staff role, gets to see them.
 */
export async function fetchBookingWhatsAppMessages(
  accessToken: string | null,
  bookingId: string,
): Promise<WhatsAppMessageRow[]> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }

  if (!bookingId) return [];

  const db = getAdminClient().database;

  const { data } = await db
    .from("whatsapp_messages")
    .select(
      "id, event, staff_id, to_phone, body_preview, status, error, created_at, delivered_at, read_at",
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as {
    id: string;
    event: string;
    staff_id: string | null;
    to_phone: string;
    body_preview: string;
    status: string;
    error: string | null;
    created_at: string;
    delivered_at: string | null;
    read_at: string | null;
  }[];

  // Resolved in one round trip rather than joined: `staff_id` points at
  // `auth.users`, not at `profiles`, so there is no relation for the SDK to
  // follow.
  const names = new Map<string, string>();
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.staff_id) ids.add(row.staff_id);
  }
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
      const name = profile.first_name?.trim() || profile.full_name?.trim();
      if (name) names.set(profile.id, name);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    event: row.event as WhatsAppMessageRow["event"],
    recipientName: row.staff_id ? (names.get(row.staff_id) ?? null) : null,
    toPhone: row.to_phone,
    bodyPreview: row.body_preview,
    status: row.status as WhatsAppMessageRow["status"],
    error: row.error,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
  }));
}
