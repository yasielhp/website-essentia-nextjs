/**
 * Shared types for the booking history.
 *
 * They live here rather than in a `"use server"` module on purpose: a type
 * re-exported from one of those compiles fine and then crashes at runtime,
 * because every export of such a module has to be an async function.
 */

/** Where the entry came from. */
export type BookingEventChannel =
  "whatsapp" | "email" | "system" | "payment" | "calendar";

/**
 * What happened.
 *
 * One vocabulary across every channel, so `cancelled` is the same word whether
 * a professional was messaged about it, the client was emailed, or somebody
 * pressed the button.
 */
export type BookingEventName =
  | "assigned"
  | "unassigned"
  | "rescheduled"
  | "cancelled"
  | "confirmed"
  | "received"
  | "created"
  | "edited"
  | "deleted"
  | "paid"
  | "failed"
  | "synced"
  | "removed";

/**
 * How far it got.
 *
 * `sent` is never a success on its own — it means the provider accepted it.
 * WhatsApp walks on to `delivered` and `read` on Meta's callbacks; an email
 * stops at `sent` until Resend's own webhook exists; anything that is not a
 * message at all is born `done`.
 */
export type BookingEventStatus =
  "skipped" | "sent" | "delivered" | "read" | "failed" | "done";

/** Who caused it. `system` is nobody: a webhook, a job, a scheduled sync. */
export type BookingEventActorRole =
  "admin" | "staff" | "partner" | "client" | "anonymous" | "system";

/** One entry as it is written. */
export type BookingEventInput = {
  bookingId: string;
  channel: BookingEventChannel;
  event: BookingEventName;
  /** The line a human reads. Worded now, not rebuilt later. */
  summary: string;
  status?: BookingEventStatus;
  actorId?: string | null;
  actorRole?: BookingEventActorRole | null;
  /** Only on `whatsapp` and `email`: the profile the message went to. */
  recipientId?: string | null;
  /** A phone in E.164, or an email address. */
  recipient?: string | null;
  error?: string | null;
  /** Meta's `wamid`, Resend's id, Redsys' order number. */
  providerId?: string | null;
  /** What changed, or the template parameters as sent. */
  payload?: Record<string, unknown> | null;
};

/** One entry as the dashboard reads it. */
export type BookingEventRow = {
  id: string;
  channel: BookingEventChannel;
  event: BookingEventName;
  /**
   * Who caused it and who received it, resolved to names. Both are ids in the
   * table and neither points at `profiles` through a relation the SDK can
   * follow, so the action resolves them itself.
   */
  actorName: string | null;
  actorRole: BookingEventActorRole | null;
  recipientName: string | null;
  recipient: string | null;
  status: BookingEventStatus;
  error: string | null;
  summary: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
};
