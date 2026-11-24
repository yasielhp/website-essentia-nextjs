import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import type { AuthContext } from "@/lib/auth-guard";
import { parseIsoDate } from "@/utils/format";
import { isSlotTaken, SLOT_TAKEN } from "./slot-taken";

/**
 * A booking taken at the desk (the dashboard's "New booking"), written by the
 * server.
 *
 * The screen used to insert the row from the browser, as the signed-in member
 * of the team, through the open INSERT policy of `bookings`. That policy also
 * let anybody with the public key insert a booking with any status, price or
 * payment, and it is gone (migration `20261124_bookings_close_browser_writes`).
 *
 * What the desk chooses travels: the service, the session type, the
 * professional, the day and hour, the place, the client, the notes and the
 * money taken at the counter. The server decides the rest from the database
 * and from WHO is asking (`requireRole` in the action): the price from the
 * session type and the place (as the screen shows it), the duration from the
 * session type, the service's name, the status (`confirmed`, as before), the
 * payment mode, and who created it. A partner's booking is hers
 * (`partner_id`), and she books only into the centre or a hotel room, as her
 * screen offers.
 *
 * The professional's hour is defended by the database (`bookings_no_overlap`):
 * an hour another booking of the same professional holds is answered
 * `slot_taken`, and the screen says so.
 */

/** A day of the calendar, `YYYY-MM-DD`: 2099-02-31 is not one. */
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => parseIsoDate(value)?.toISOString().slice(0, 10) === value);
const hourMinute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const deskBookingSchema = z.strictObject({
  serviceId: z.string().trim().min(1).max(64),
  tierId: z.guid().nullable(),
  staffId: z.guid().nullable(),
  date: isoDay.nullable(),
  time: hourMinute.nullable(),
  location: z.enum(["centro", "habitacion", "domicilio"]).nullable(),
  /** Room and reservation, or the street address: JSON, as the row keeps it. */
  locationAddress: z.string().max(2000).nullable(),
  notes: z.string().trim().max(4000).nullable(),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120),
  email: z.email().max(254),
  phone: z.string().trim().max(40).nullable(),
  /** The contact the screen found or wrote for this address. */
  contactId: z.guid().nullable(),
  /** The money taken at the counter, as the desk says it. */
  payment: z.strictObject({
    status: z.enum(["pending", "deposit_paid", "paid"]),
    amountPaidEur: z.number().finite().min(0).max(100_000),
    method: z.enum(["cash", "card", "transfer", "other"]).nullable(),
  }),
});
export type DeskBookingInput = z.input<typeof deskBookingSchema>;

export type DeskCreateError =
  | typeof SLOT_TAKEN
  /** Not what the screen sends, or a choice the database does not have. */
  | "invalid"
  /** A partner asking for what is not hers to do (a home visit). */
  | "forbidden"
  | "failed";

export type DeskCreateResult =
  { ok: true; bookingId: string } | { ok: false; error: DeskCreateError };

type TierRow = {
  id: string;
  service_id: string | null;
  duration_minutes: number | null;
  price_eur: number | string | null;
  price_center_eur: number | string | null;
  price_suite_eur: number | string | null;
};

const num = (value: number | string | null): number | null =>
  value === null || value === undefined ? null : Number(value);

/** The price the screen shows for this place: a hotel room has its own. */
export function deskPrice(
  tier: TierRow | null,
  location: string | null,
): number | null {
  if (!tier) return null;
  if (location === "habitacion") {
    return (
      num(tier.price_suite_eur) ??
      num(tier.price_center_eur) ??
      num(tier.price_eur)
    );
  }
  return num(tier.price_center_eur) ?? num(tier.price_eur);
}

export async function createDeskBookingCore(
  actor: Pick<AuthContext, "userId" | "role">,
  raw: unknown,
): Promise<DeskCreateResult> {
  const parsed = deskBookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;

  // A partner books into the centre or a hotel room; a home visit is not
  // hers to offer (the screen does not show it to her either).
  const isPartner = actor.role === "partner";
  if (
    isPartner &&
    input.location !== null &&
    input.location !== "centro" &&
    input.location !== "habitacion"
  ) {
    return { ok: false, error: "forbidden" };
  }

  try {
    const db = getAdminClient().database;

    const { data: serviceRow, error: serviceError } = await db
      .from("service_settings")
      .select("id, title")
      .eq("id", input.serviceId)
      .maybeSingle();
    if (serviceError) return { ok: false, error: "failed" };
    const service = serviceRow as { id: string; title: string | null } | null;
    if (!service) return { ok: false, error: "invalid" };

    let tier: TierRow | null = null;
    if (input.tierId) {
      const { data, error } = await db
        .from("service_tiers")
        .select(
          "id, service_id, duration_minutes, price_eur, price_center_eur, price_suite_eur",
        )
        .eq("id", input.tierId)
        .maybeSingle();
      if (error) return { ok: false, error: "failed" };
      tier = data as TierRow | null;
      // A session type of another service would price this one by its rate.
      if (!tier || tier.service_id !== input.serviceId) {
        return { ok: false, error: "invalid" };
      }
    }

    // Money taken is a status with an amount; nothing taken is "pending".
    const paid =
      input.payment.status === "pending" ? 0 : input.payment.amountPaidEur;
    const paymentStatus = paid > 0 ? input.payment.status : "pending";
    const settled = paymentStatus === "paid" && input.payment.method !== null;

    const bookingId = crypto.randomUUID();
    const { error } = await db.from("bookings").insert([
      {
        id: bookingId,
        service_id: service.id,
        service_title: service.title ?? service.id,
        tier_id: tier?.id ?? null,
        price_eur: deskPrice(tier, input.location),
        duration:
          tier?.duration_minutes != null
            ? `${tier.duration_minutes} min`
            : null,
        date: input.date,
        time: input.time,
        location: input.location,
        location_address: input.locationAddress,
        ...(input.staffId ? { staff_id: input.staffId } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone || null,
        ...(input.contactId ? { contact_id: input.contactId } : {}),
        status: "confirmed",
        payment_status: paymentStatus,
        // Never `deposit`: money taken in part at the counter is a booking
        // paid at the centre (`none`) with something still owed.
        payment_mode: paymentStatus === "paid" ? "full" : "none",
        amount_paid_eur: paid,
        ...(settled
          ? {
              balance_settled_at: new Date().toISOString(),
              balance_settled_method: input.payment.method,
            }
          : {}),
        ...(isPartner ? { partner_id: actor.userId } : {}),
        created_by_user_id: actor.userId,
        created_by_role: actor.role,
      },
    ]);
    if (error) {
      if (isSlotTaken(error)) return { ok: false, error: SLOT_TAKEN };
      console.error("[desk booking] the booking could not be written:", error);
      return { ok: false, error: "failed" };
    }
    return { ok: true, bookingId };
  } catch (err) {
    console.error("[desk booking] the booking could not be written:", err);
    return { ok: false, error: "failed" };
  }
}
