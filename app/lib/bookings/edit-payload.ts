import { z } from "zod";
import { parseIsoDate } from "@/utils/format";
import type { UpdateBookingPayload } from "@/types/booking";

/**
 * What the dashboard's edit screen may send for a booking
 * (`updateBookingByAdmin`), checked before anything is read or written. A
 * strict object: a key the screen does not send (a partner, a claim token, a
 * creator) refuses the whole save. The day is a calendar day, the hour
 * `HH:MM`, the status and the payment one of their own values.
 */

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => parseIsoDate(value)?.toISOString().slice(0, 10) === value);
const hourMinute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const money = z.number().finite().min(0).max(100_000);

export const editPayloadSchema = z.strictObject({
  service_id: z.string().trim().min(1).max(64),
  staff_id: z.guid().nullable().optional(),
  service_title: z.string().trim().min(1).max(200),
  tier_id: z.guid().nullable(),
  price_eur: money.nullable().optional(),
  duration: z.string().max(40).nullable(),
  date: isoDay.nullable(),
  time: hourMinute.nullable(),
  location: z.string().max(40).nullable(),
  location_address: z.string().max(2000).nullable(),
  notes: z.string().max(4000).nullable(),
  first_name: z.string().max(120),
  last_name: z.string().max(120),
  email: z.string().max(254),
  phone: z.string().max(40).nullable(),
  status: z.enum([
    "draft",
    "pending",
    "confirmed",
    "cancelled",
    "completed",
    "paid",
  ]),
  payment_status: z
    .enum(["pending", "deposit_paid", "paid", "failed", "refunded"])
    .optional(),
  payment_mode: z
    .enum(["deposit", "full", "bonus", "none"])
    .nullable()
    .optional(),
  amount_paid_eur: money.optional(),
  balance_settled_at: z.iso.datetime({ offset: true }).nullable().optional(),
  balance_settled_method: z
    .enum(["cash", "card", "transfer", "other"])
    .nullable()
    .optional(),
});

/** The payload, checked, or null when it is not what the screen sends. */
export function readEditPayload(input: unknown): UpdateBookingPayload | null {
  const parsed = editPayloadSchema.safeParse(input);
  return parsed.success ? (parsed.data as UpdateBookingPayload) : null;
}
