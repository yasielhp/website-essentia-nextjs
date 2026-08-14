/**
 * Shared types for the staff WhatsApp notifications.
 *
 * They live here rather than in `app/actions/staff-whatsapp.ts` on purpose:
 * a type re-exported from a `"use server"` module compiles fine and then
 * crashes at runtime, because every export of such a module has to be an async
 * function.
 */

import type { BookingEventActorRole } from "@/lib/booking-events/types";

/** What happened to the booking, from the point of view of the professional. */
export type StaffWhatsAppEvent =
  "assigned" | "unassigned" | "rescheduled" | "cancelled";

export type StaffWhatsAppInput = {
  bookingId: string;
  staffId: string;
  event: StaffWhatsAppEvent;
  /**
   * Who caused the notification, when the caller knows. The history is read to
   * settle "nobody told me", and an entry that cannot name the person who
   * assigned the booking only answers half the question. The anonymous flows
   * leave it out and the entry is recorded as the system's own doing.
   */
  actorId?: string | null;
  actorRole?: BookingEventActorRole | null;
};

export type WhatsAppSendResult =
  | { status: "sent"; providerId: string | null }
  | { status: "skipped" }
  | { status: "failed"; error: string };
