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

  const { data } = await getAdminClient()
    .database.from("whatsapp_messages")
    .select("id, event, to_phone, body_preview, status, error, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  return (
    (data ?? []) as {
      id: string;
      event: string;
      to_phone: string;
      body_preview: string;
      status: string;
      error: string | null;
      created_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    event: row.event as WhatsAppMessageRow["event"],
    toPhone: row.to_phone,
    bodyPreview: row.body_preview,
    status: row.status as WhatsAppMessageRow["status"],
    error: row.error,
    createdAt: row.created_at,
  }));
}
