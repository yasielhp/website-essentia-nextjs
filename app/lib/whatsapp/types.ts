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

/**
 * `draft` is ours; the rest are Meta's, stored exactly as it sends them.
 * Only `APPROVED` can be sent.
 */
export type WhatsAppTemplateStatus =
  | "draft"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "PENDING_DELETION"
  | "DELETED"
  | "LIMIT_EXCEEDED"
  | "ARCHIVED"
  | "LOCKED"
  | "FLAGGED";

/** Why a synced template cannot be sent from the dashboard; see `templateSupport`. */
export type WhatsAppTemplateUnsupportedReason =
  "media_header" | "header_variable" | "named_params" | "button_type";

/** The categories the dashboard can show and send; one source for all uses. */
export const WHATSAPP_TEMPLATE_CATEGORIES = ["MARKETING", "UTILITY"] as const;

export type WhatsAppTemplateCategory =
  (typeof WHATSAPP_TEMPLATE_CATEGORIES)[number];

export type WhatsAppTemplateButton =
  | { type: "URL"; text: string; url: string }
  | { type: "QUICK_REPLY"; text: string };

export type WhatsAppTemplateRow = {
  id: string;
  meta_id: string | null;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  status: WhatsAppTemplateStatus;
  header_format: string | null;
  header_text: string | null;
  body: string;
  footer_text: string | null;
  buttons: WhatsAppTemplateButton[];
  param_count: number;
  example_params: string[];
  rejection_reason: string | null;
  /** Null when we can send it. The picker must also require `APPROVED`. */
  unsupported_reason: WhatsAppTemplateUnsupportedReason | null;
  synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * De dónde sale cada {{n}} al enviar. `field` lee del contacto o de la
 * reserva; `static` es texto fijo escrito por el admin.
 */
export type WhatsAppParamSource =
  | { kind: "field"; field: WhatsAppParamField }
  | { kind: "static"; value: string };

export type WhatsAppParamField =
  | "first_name"
  | "last_name"
  | "service"
  | "session_type"
  | "date"
  | "time"
  | "post_title"
  | "post_url";
