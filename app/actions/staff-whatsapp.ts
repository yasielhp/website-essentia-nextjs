"use server";

import { z } from "zod";
import { AuthError, DASHBOARD_ROLES, requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { bookingAccess } from "@/lib/bookings/booking-access";
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
/** What the booking screens send: two ids and one of the four events. */
const inputSchema = z.strictObject({
  bookingId: z.guid(),
  staffId: z.guid(),
  event: z.enum(["assigned", "unassigned", "rescheduled", "cancelled"]),
});

export async function notifyStaffWhatsApp(
  accessToken: string | null,
  input: { bookingId: string; staffId: string; event: StaffWhatsAppEvent },
): Promise<void> {
  let actorId: string | null = null;
  let actorRole: BookingEventActorRole | null = null;

  // Silent by design, every refusal below: the caller has already saved the
  // booking and shows its own errors. A refused call simply gets nothing sent.
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return;
  const { bookingId, staffId, event } = parsed.data;

  try {
    // The same check that guards the endpoint also names the person behind it,
    // so the history can say who assigned or cancelled without trusting the
    // browser to tell us.
    const context = await requireRole(accessToken);
    actorId = context.userId;
    actorRole = context.role as BookingEventActorRole;

    // Only on a booking this member may act on (a partner's own) ...
    const access = await bookingAccess(context, bookingId);
    if (!access.ok) return;
    // ... and only to the person the booking is about. "Assigned" and
    // "rescheduled" go to its professional as it stands. "Unassigned" goes to
    // the one it was taken from, and "cancelled" to whoever held it, who may
    // have been taken off in the same save: either is no longer on the row,
    // but must be somebody of the team. Never a number the caller picks.
    const holder = access.booking.staff_id === staffId;
    if (event === "assigned" || event === "rescheduled") {
      if (!holder) return;
    } else if (!holder && !(await isTeamMember(staffId))) {
      return;
    }
  } catch (err) {
    if (err instanceof AuthError) return;
    throw err;
  }

  await notifyStaffOnWhatsApp({
    bookingId,
    staffId,
    event,
    actorId,
    actorRole,
  });
}

/** Whether a profile belongs to the team (admin, staff or partner). */
async function isTeamMember(profileId: string): Promise<boolean> {
  const { data } = await getAdminClient()
    .database.from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  const role = (data as { role: string | null } | null)?.role;
  return DASHBOARD_ROLES.includes(role as (typeof DASHBOARD_ROLES)[number]);
}
