import { fetchAvailability } from "@/actions/availability";
import { bookableServices } from "@/data/services-data";
import { getAdminClient } from "@/lib/insforge-admin";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type { BookingEventActorRole } from "@/lib/booking-events/types";
import { pushBookingToCalendars } from "@/lib/calendar-sync";
import { removeBookingFromCalendars } from "@/lib/calendar-propagate";
import { notifyStaffOnWhatsApp } from "@/lib/whatsapp/notify";
import { notifyBookingCore } from "@/lib/bookings/notify";
import { parseIsoDate } from "@/utils/format";

/**
 * Taking and cancelling a booking on behalf of the centre, with no browser in
 * between: what the dashboard's forms do, for the MCP tools.
 *
 * SERVER ONLY and with no check of who is asking — the caller has already
 * authenticated the person and passes who they are. The rules are the
 * dashboard's: the session type must be active, the professional assigned to
 * it, the hour free by the same availability the public form uses; the booking
 * is born confirmed and unpaid; the client, the professional and the calendars
 * hear about it the same way.
 */

export type Actor = { userId: string | null; role: string };

const db = () => getAdminClient().database;

const actorOf = (actor: Actor) => ({
  actorId: actor.userId,
  actorRole: actor.role as BookingEventActorRole,
});

type Tier = {
  id: string;
  service_id: string | null;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | string | null;
  price_center_eur: number | string | null;
  price_suite_eur: number | string | null;
  active: boolean;
};

/** The price a booking carries: the suite price at a hotel room, the centre's otherwise. */
export function priceFor(
  tier: Pick<Tier, "price_eur" | "price_center_eur" | "price_suite_eur">,
  location: "centro" | "habitacion" | "domicilio",
): number | null {
  const pick = (v: number | string | null | undefined) =>
    v == null ? null : Number(v);
  if (location === "habitacion") {
    return (
      pick(tier.price_suite_eur) ??
      pick(tier.price_center_eur) ??
      pick(tier.price_eur)
    );
  }
  return pick(tier.price_center_eur) ?? pick(tier.price_eur);
}

/** The first free hours, enough to suggest another without flooding the answer. */
function freeHours(times: string[]): string {
  if (times.length === 0) return "none";
  const shown = times.slice(0, 12).join(", ");
  return times.length > 12 ? `${shown} … (${times.length} in all)` : shown;
}

/** `jueves 20 ago, 14:00`, the way the history writes a moment. */
function humanMoment(date: string, time: string): string {
  const parsed = parseIsoDate(date);
  if (!parsed) return `${date} ${time}`;
  const day = parsed
    .toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .replace(",", "");
  return `${day}, ${time}`;
}

/** The address as the row stores it: JSON whose shape depends on the place. */
function addressJson(
  location: "centro" | "habitacion" | "domicilio",
  text: string | undefined,
): string | null {
  if (!text) return null;
  if (location === "domicilio") {
    return JSON.stringify({
      street: text,
      building: "",
      postalCode: "",
      municipality: "",
    });
  }
  return JSON.stringify({ roomNumber: text, reservationNumber: "" });
}

export type CreateInput = {
  tierId: string;
  staffId: string;
  date: string;
  time: string;
  location: "centro" | "habitacion" | "domicilio";
  locationAddress?: string;
  notes?: string;
  client: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    language: "en" | "es";
  };
  dryRun: boolean;
};

export type CreateResult =
  | { ok: false; error: string }
  | {
      ok: true;
      dryRun: boolean;
      bookingId: string | null;
      summary: {
        service: string;
        session_type: string | null;
        date: string;
        time: string;
        duration: string;
        staff: string | null;
        price_eur: number | null;
        location: string;
        client: string;
      };
      notified?: { client: boolean; professional: boolean; calendar: boolean };
    };

export async function createBookingForStaff(
  input: CreateInput,
  actor: Actor,
): Promise<CreateResult> {
  const { data: tierData } = await db()
    .from("service_tiers")
    .select(
      "id, service_id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, active",
    )
    .eq("id", input.tierId)
    .maybeSingle();
  const tier = tierData as Tier | null;
  if (!tier || !tier.active) {
    return {
      ok: false,
      error: "tier_id is not an active session type (see list_session_types).",
    };
  }

  const { data: assigned } = await db()
    .from("staff_tiers")
    .select("staff_id")
    .eq("tier_id", tier.id)
    .eq("staff_id", input.staffId)
    .maybeSingle();
  if (!assigned) {
    return {
      ok: false,
      error:
        "That professional does not perform this session type (see list_staff with tier_id).",
    };
  }

  const durationMinutes = tier.duration_minutes ?? 60;
  const availability = await fetchAvailability({
    tierId: tier.id,
    staffId: input.staffId,
    from: input.date,
    to: input.date,
    durationMinutes,
  });
  if (!(availability[input.date] ?? []).includes(input.time)) {
    return {
      ok: false,
      error: `${input.time} on ${input.date} is not free for that professional. Free hours that day: ${freeHours(availability[input.date] ?? [])}.`,
    };
  }

  const { data: staffRow } = await db()
    .from("profiles")
    .select("full_name, first_name")
    .eq("id", input.staffId)
    .maybeSingle();
  const staff = staffRow as {
    full_name: string | null;
    first_name: string | null;
  } | null;

  const serviceTitle =
    bookableServices.find((s) => s.id === tier.service_id)?.title ??
    tier.service_id ??
    "";
  const duration = `${durationMinutes} min`;
  const price = priceFor(tier, input.location);
  const clientName = [input.client.firstName, input.client.lastName]
    .filter(Boolean)
    .join(" ");

  const summary = {
    service: serviceTitle,
    session_type: tier.label,
    date: input.date,
    time: input.time,
    duration,
    staff: staff?.full_name ?? staff?.first_name ?? null,
    price_eur: price,
    location: input.location,
    client: clientName,
  };
  if (input.dryRun) {
    return { ok: true, dryRun: true, bookingId: null, summary };
  }

  // Same call the dashboard and the public form make. The newsletter flag is
  // `null`: taking a booking for someone is not their consent to a mailing list.
  const { data: contactId, error: contactError } = await db().rpc(
    "upsert_contact",
    {
      p_email: input.client.email,
      p_first_name: input.client.firstName,
      p_last_name: input.client.lastName,
      p_phone: input.client.phone ?? null,
      p_language: input.client.language,
      p_gender: null,
      p_newsletter: null,
    },
  );
  if (contactError) console.error("[mcp] upsert_contact failed");

  const bookingId = crypto.randomUUID();
  const { error } = await db()
    .from("bookings")
    .insert([
      {
        id: bookingId,
        service_id: tier.service_id,
        service_title: serviceTitle,
        tier_id: tier.id,
        price_eur: price,
        duration,
        date: input.date,
        time: input.time,
        location: input.location,
        location_address: addressJson(input.location, input.locationAddress),
        staff_id: input.staffId,
        ...(input.notes ? { notes: input.notes } : {}),
        first_name: input.client.firstName,
        last_name: input.client.lastName,
        email: input.client.email,
        phone: input.client.phone ?? null,
        ...(contactId ? { contact_id: contactId as string } : {}),
        status: "confirmed",
        payment_status: "pending",
        payment_mode: "none",
        amount_paid_eur: 0,
        created_by_user_id: actor.userId,
        created_by_role: actor.role,
      },
    ]);
  if (error) return { ok: false, error: "The booking could not be saved." };

  await recordBookingEvent({
    bookingId,
    channel: "system",
    event: "created",
    ...actorOf(actor),
    summary: `Reserva creada desde un asistente · ${serviceTitle} · ${humanMoment(input.date, input.time)}`,
  });

  // Telling people must never undo a booking that is already saved.
  const notified = { client: false, professional: false, calendar: false };
  try {
    await notifyBookingCore(
      {
        bookingId,
        event: "confirmed",
        clientName,
        clientEmail: input.client.email,
        clientPhone: input.client.phone ?? null,
        service: serviceTitle,
        serviceId: tier.service_id,
        sessionType: tier.label,
        date: input.date,
        time: input.time,
        duration,
        locale: input.client.language,
      },
      actorOf(actor),
    );
    notified.client = true;
  } catch {
    console.error("[mcp] client notification failed");
  }
  try {
    await notifyStaffOnWhatsApp({
      bookingId,
      staffId: input.staffId,
      event: "assigned",
      ...actorOf(actor),
    });
    notified.professional = true;
  } catch {
    console.error("[mcp] whatsapp failed");
  }
  try {
    await pushBookingToCalendars(bookingId);
    notified.calendar = true;
  } catch {
    console.error("[mcp] calendar failed");
  }

  return { ok: true, dryRun: false, bookingId, summary, notified };
}

export type CancelResult =
  | { ok: false; error: "not_found" | "already_cancelled" | "failed" }
  | {
      ok: true;
      bookingId: string;
      paid_eur: number;
      notified: { client: boolean; professional: boolean; calendar: boolean };
    };

/**
 * Cancels a booking as the dashboard does: the status, the history, the
 * client's email, the professional's WhatsApp and the calendars. Money already
 * collected is *not* returned — `paid_eur` says how much there is to settle by
 * hand.
 */
export async function cancelBookingForStaff(
  bookingId: string,
  reason: string | undefined,
  actor: Actor,
): Promise<CancelResult> {
  const { data } = await db()
    .from("bookings")
    .select(
      "id, status, service_id, service_title, date, time, duration, first_name, last_name, email, phone, staff_id, amount_paid_eur, contact_id, service_tiers(label)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  const booking = data as unknown as {
    id: string;
    status: string | null;
    service_id: string | null;
    service_title: string | null;
    date: string | null;
    time: string | null;
    duration: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    staff_id: string | null;
    amount_paid_eur: number | string | null;
    contact_id: string | null;
    service_tiers: { label: string | null } | null;
  } | null;
  if (!booking) return { ok: false, error: "not_found" };
  if (booking.status === "cancelled") {
    return { ok: false, error: "already_cancelled" };
  }

  // Conditioned on the status just read, so two cancellations at once act once.
  const { data: updated, error } = await db()
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .neq("status", "cancelled")
    .select("id");
  if (error) return { ok: false, error: "failed" };
  if (((updated ?? []) as unknown[]).length === 0) {
    return { ok: false, error: "already_cancelled" };
  }

  await recordBookingEvent({
    bookingId,
    channel: "system",
    event: "cancelled",
    ...actorOf(actor),
    summary: `Reserva cancelada desde un asistente${reason ? ` · ${reason}` : ""}`,
    payload: {
      status: { before: booking.status, after: "cancelled" },
      reason: reason ?? null,
    },
  });

  const notified = { client: false, professional: false, calendar: false };

  if (booking.email && booking.date) {
    let locale: "en" | "es" = "es";
    if (booking.contact_id) {
      const { data: contact } = await db()
        .from("contacts")
        .select("preferred_language")
        .eq("id", booking.contact_id)
        .maybeSingle();
      locale =
        (contact as { preferred_language: string | null } | null)
          ?.preferred_language === "en"
          ? "en"
          : "es";
    }
    try {
      await notifyBookingCore(
        {
          bookingId,
          event: "cancelled",
          clientName: [booking.first_name, booking.last_name]
            .filter(Boolean)
            .join(" "),
          clientEmail: booking.email,
          clientPhone: booking.phone,
          service: booking.service_title ?? "",
          serviceId: booking.service_id,
          sessionType: booking.service_tiers?.label ?? null,
          date: booking.date.slice(0, 10),
          time: booking.time ?? "",
          duration: booking.duration,
          locale,
        },
        actorOf(actor),
      );
      notified.client = true;
    } catch {
      console.error("[mcp] cancellation email failed");
    }
  }

  if (booking.staff_id) {
    try {
      await notifyStaffOnWhatsApp({
        bookingId,
        staffId: booking.staff_id,
        event: "cancelled",
        ...actorOf(actor),
      });
      notified.professional = true;
    } catch {
      console.error("[mcp] whatsapp failed");
    }
  }
  try {
    await removeBookingFromCalendars(bookingId);
    notified.calendar = true;
  } catch {
    console.error("[mcp] calendar removal failed");
  }

  return {
    ok: true,
    bookingId,
    paid_eur: Number(booking.amount_paid_eur ?? 0),
    notified,
  };
}
