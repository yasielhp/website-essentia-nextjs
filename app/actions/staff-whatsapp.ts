"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { notifyStaffOnWhatsApp } from "@/lib/whatsapp/notify";
import type { StaffWhatsAppEvent } from "@/lib/whatsapp/types";
import type { BookingEventActorRole } from "@/lib/booking-events/types";

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
  let actorId: string | null = null;
  let actorRole: BookingEventActorRole | null = null;

  try {
    // The same check that guards the endpoint also names the person behind it,
    // so the history can say who assigned or cancelled without trusting the
    // browser to tell us.
    const context = await requireRole(accessToken);
    actorId = context.userId;
    actorRole = context.role as BookingEventActorRole;
  } catch (err) {
    // Silent by design: the caller has already saved the booking and shows its
    // own errors. An unauthorised caller simply gets nothing sent.
    if (err instanceof AuthError) return;
    throw err;
  }

  await notifyStaffOnWhatsApp({ ...input, actorId, actorRole });
}
