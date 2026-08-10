/**
 * Shared types for the staff WhatsApp notifications.
 *
 * They live here rather than in `app/actions/staff-whatsapp.ts` on purpose:
 * a type re-exported from a `"use server"` module compiles fine and then
 * crashes at runtime, because every export of such a module has to be an async
 * function.
 */

/** What happened to the booking, from the point of view of the professional. */
export type StaffWhatsAppEvent =
  "assigned" | "unassigned" | "rescheduled" | "cancelled";

export type StaffWhatsAppInput = {
  bookingId: string;
  staffId: string;
  event: StaffWhatsAppEvent;
};

export type WhatsAppSendResult =
  | { status: "sent"; providerId: string | null }
  | { status: "skipped" }
  | { status: "failed"; error: string };

/** One row of `whatsapp_messages`, as the dashboard reads it. */
export type WhatsAppMessageRow = {
  id: string;
  event: StaffWhatsAppEvent;
  toPhone: string;
  bodyPreview: string;
  status: "skipped" | "sent" | "failed";
  error: string | null;
  createdAt: string;
};
