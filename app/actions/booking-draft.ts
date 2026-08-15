"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { onlineDiscountPercent } from "@/lib/pricing";
import { AuthError, requireRole, type AuthContext } from "@/lib/auth-guard";
import { notifyStaffOnWhatsApp } from "@/lib/whatsapp/notify";
import { removeBookingFromCalendars } from "@/lib/calendar-propagate";
import {
  recordBookingEvent,
  recordBookingEvents,
} from "@/lib/booking-events/record";
import type {
  BookingEventActorRole,
  BookingEventInput,
} from "@/lib/booking-events/types";
import { parseIsoDate } from "@/utils/format";
import type { UpdateBookingPayload } from "@/types/booking";

/**
 * Booking mutations.
 *
 * Two access models live here, and the distinction matters:
 *
 * - **Draft actions** run for anonymous visitors in the public booking flow, so
 *   they cannot require a role. Instead they are scoped to `status = 'draft'`,
 *   mirroring the `WHERE ... AND status = 'draft'` guard already present in the
 *   `update_booking_datetime` / `confirm_booking` SQL functions. Without it,
 *   knowing any booking id was enough to rewrite a confirmed booking.
 * - **Dashboard actions** require a staff role via the caller's access token.
 *
 * Every mutation here also writes its own line into the booking history, for
 * the same reason the notifications are sent from where the change happens: an
 * entry composed anywhere else could describe a change that never landed, and
 * the trail is what the centre reads to settle who moved a session to Thursday.
 */

/**
 * `jueves 20 ago, 14:00` — a moment as the person reading the history says it.
 *
 * The trail is prose, and an ISO date dropped into the middle of a sentence is
 * the one thing on that screen nobody can read at a glance.
 */
function humanMoment(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  const parsed = parseIsoDate(date);
  if (!parsed) return time || "sin fecha";

  // Spanish puts a comma after the weekday, which would collide with the one
  // separating the day from the hour: `jueves, 20 ago, 14:00`.
  const day = parsed
    .toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .replace(",", "");

  return time ? `${day}, ${time}` : day;
}

/** `Reserva creada · Terapias manuales · jueves 20 ago, 14:00`. */
function bookingLine(
  prefix: string,
  serviceTitle: string | null | undefined,
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  return [prefix, serviceTitle?.trim(), humanMoment(date, time)]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The first names of the people a booking changed hands between.
 *
 * The first name and not the full one: the summary is a sentence about a
 * colleague, and `Profesional cambiado de Yuliana Pérez a Dolores Ramírez` is
 * not how anyone at the centre refers to them.
 */
async function staffFirstNames(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (wanted.length === 0) return names;

  const { data } = await getAdminClient()
    .database.from("profiles")
    .select("id, first_name, full_name")
    .in("id", wanted);

  for (const profile of (data ?? []) as {
    id: string;
    first_name: string | null;
    full_name: string | null;
  }[]) {
    const name =
      profile.first_name?.trim() || profile.full_name?.trim().split(" ")[0];
    if (name) names.set(profile.id, name);
  }
  return names;
}

/** Attaches tier, price and notes to a booking that is still a draft. */
// Anonymous by design and scoped to `status = 'draft'`, as the note at the
// top of this file explains: the public booking flow has no session, and the
// draft scope is what stops a known id from rewriting a confirmed booking.
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function updateDraftBookingMeta(
  bookingId: string,
  tierId: string | null,
  /** Ignored for the amount: prices are read from the tier. Kept for callers. */
  _tierPrice: number | null,
  createdByUserId: string | null,
  createdByRole: string,
  notes: string | null,
  staffId: string | null = null,
  paymentMethod: "online" | "on-site" = "online",
): Promise<void> {
  if (!bookingId) return;

  const db = getAdminClient().database;

  // The two prices come from the tier, so editing them in the dashboard is
  // enough — and so a tampered request cannot lower what gets recorded.
  let centrePrice: number | null = null;
  let onlinePriceEur: number | null = null;
  if (tierId) {
    const { data } = await db
      .from("service_tiers")
      .select("price_eur, price_center_eur")
      .eq("id", tierId)
      .limit(1);
    const tier = (
      data as
        { price_eur: number | null; price_center_eur: number | null }[] | null
    )?.[0];
    centrePrice = tier?.price_center_eur ?? tier?.price_eur ?? null;
    onlinePriceEur = tier?.price_eur ?? centrePrice;
  }

  const amountEur = paymentMethod === "online" ? onlinePriceEur : centrePrice;

  // Staff need to know at a glance whether the money is still to be collected.
  const percent = onlineDiscountPercent(centrePrice, onlinePriceEur);
  const paymentNote =
    paymentMethod === "on-site"
      ? "Pago: en el centro (precio íntegro)"
      : percent > 0
        ? `Pago: online (−${percent}%)`
        : "Pago: online";
  const composedNotes =
    [paymentNote, notes].filter(Boolean).join("\n\n") || null;

  await db
    .from("bookings")
    .update({
      tier_id: tierId,
      ...(staffId ? { staff_id: staffId } : {}),
      price_eur: amountEur,
      location: "centro",
      ...(composedNotes ? { notes: composedNotes } : {}),
      ...(createdByUserId ? { created_by_user_id: createdByUserId } : {}),
      created_by_role: createdByRole,
    })
    .eq("id", bookingId)
    .eq("status", "draft");
}

/**
 * Rewrites the details of a draft the visitor already started.
 *
 * The booking flow used to call `create_draft_booking` every time the details
 * step was submitted, so going back a step and forward again — or correcting a
 * typo in an email — left the previous draft behind. One visitor produced eight
 * rows for what was plainly one attempt.
 *
 * Everything the earlier steps can still change is included, because the
 * visitor may have gone back past the details step and chosen another service
 * before returning.
 */
// Same reasoning: anonymous visitor, writes confined to their own draft.
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function updateDraftBookingDetails(
  bookingId: string,
  details: {
    contactId: string | null;
    userId: string | null;
    serviceId: string;
    serviceTitle: string;
    duration: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  },
): Promise<void> {
  if (!bookingId) return;

  await getAdminClient()
    .database.from("bookings")
    .update({
      // Only overwrite the links when we have one, so a failed upsert_contact
      // does not detach a draft that was already attached.
      ...(details.contactId ? { contact_id: details.contactId } : {}),
      ...(details.userId ? { user_id: details.userId } : {}),
      service_id: details.serviceId,
      service_title: details.serviceTitle,
      duration: details.duration,
      first_name: details.firstName,
      last_name: details.lastName,
      email: details.email,
      phone: details.phone,
    })
    .eq("id", bookingId)
    .eq("status", "draft");
}

/** Promotes a draft booking to `pending`. */
// Anonymous by design. The write is scoped to `status = 'draft'`, and the
// WhatsApp below only goes out on the actual draft → pending transition, so a
// replay cannot ring the professional twice.
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function confirmDraftBooking(
  bookingId: string,
  tierId: string | null,
  tierPrice: number | null,
  duration: string,
  date: string,
  time: string,
): Promise<void> {
  if (!bookingId) return;

  const db = getAdminClient().database;

  // Read the state first, and leave if this booking is no longer a draft.
  //
  // The update below is already scoped to `status = 'draft'`, so a second call
  // cannot rewrite a confirmed booking — but the WhatsApp that follows is a
  // message to a real phone, and this action is public and unauthenticated by
  // design. Sending it without checking would let anyone holding a booking id
  // ring the same professional as often as they liked.
  const { data: before } = await db
    .from("bookings")
    .select("status, staff_id, service_title")
    .eq("id", bookingId)
    .maybeSingle();

  const row = before as {
    status: string | null;
    staff_id: string | null;
    service_title: string | null;
  } | null;
  if (row?.status !== "draft") return;

  await db
    .from("bookings")
    .update({
      status: "pending",
      tier_id: tierId,
      price_eur: tierPrice,
      duration,
      location: "centro",
      date,
      time,
    })
    .eq("id", bookingId)
    .eq("status", "draft");

  // The visitor has no session, so nobody is named as the actor. `anonymous`
  // rather than `system` because a person did this: it is the public booking
  // form, not a job.
  await recordBookingEvent({
    bookingId,
    channel: "system",
    event: "created",
    actorRole: "anonymous",
    summary: bookingLine(
      "Reserva solicitada desde la web",
      row.service_title,
      date,
      time,
    ),
  });

  // Only now does the visitor's choice become a session someone has to be
  // there for, and only now are the date and time settled — so this, and not
  // the moment the professional was picked, is when the WhatsApp goes out.
  if (row.staff_id) {
    await notifyStaffOnWhatsApp({
      bookingId,
      staffId: row.staff_id,
      event: "assigned",
    });
  }
}

/**
 * Records a booking taken at the desk, once its row exists.
 *
 * It lives here rather than beside the form that creates it because that form
 * runs in the browser, and `recordBookingEvent` writes with the service key —
 * so the entry has to be written on this side of the wire. A role is required
 * for the same reason every other action here requires one: a Server Action is
 * a public endpoint, and an unguarded one would let anybody invent entries in
 * the record the centre trusts.
 *
 * The wording is built from the stored row rather than from the form, so the
 * history can only ever describe a booking that was really written.
 */
export async function recordBookingCreated(
  accessToken: string | null,
  bookingId: string,
): Promise<void> {
  let actor: AuthContext;
  try {
    actor = await requireRole(accessToken);
  } catch (err) {
    // A missing entry is not worth failing a booking that is already saved.
    if (err instanceof AuthError) return;
    throw err;
  }

  if (!bookingId) return;

  const { data } = await getAdminClient()
    .database.from("bookings")
    .select("service_title, date, time")
    .eq("id", bookingId)
    .maybeSingle();

  const row = data as {
    service_title: string | null;
    date: string | null;
    time: string | null;
  } | null;

  await recordBookingEvent({
    bookingId,
    channel: "system",
    event: "created",
    actorId: actor.userId,
    actorRole: actor.role as BookingEventActorRole,
    summary: bookingLine(
      "Reserva creada",
      row?.service_title,
      row?.date,
      row?.time,
    ),
  });
}

/** Deletes a booking outright. Staff only. */
export async function deleteBooking(
  accessToken: string | null,
  bookingId: string,
): Promise<{ error: string | null }> {
  let actor: AuthContext;
  try {
    actor = await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!bookingId) return { error: "Falta el identificador de la reserva." };

  // Before the row goes: the event ids live on it and on its mirror rows, and
  // once they are deleted there is nothing left to find the events by.
  await removeBookingFromCalendars(bookingId);

  // Also before the row goes, and for the same kind of reason: the entry points
  // at the booking through a foreign key, so an insert once it is gone would be
  // refused. The column is `ON DELETE SET NULL`, so the entry outlives what it
  // describes — which is why the summary names the session rather than leaving
  // a reader to follow a link that no longer goes anywhere.
  const { data } = await getAdminClient()
    .database.from("bookings")
    .select("service_title, date, time")
    .eq("id", bookingId)
    .maybeSingle();

  const removed = data as {
    service_title: string | null;
    date: string | null;
    time: string | null;
  } | null;

  await recordBookingEvent({
    bookingId,
    channel: "system",
    event: "deleted",
    actorId: actor.userId,
    actorRole: actor.role as BookingEventActorRole,
    summary: bookingLine(
      "Reserva eliminada",
      removed?.service_title,
      removed?.date,
      removed?.time,
    ),
  });

  const { error } = await getAdminClient()
    .database.from("bookings")
    .delete()
    .eq("id", bookingId);

  return { error: (error as { message?: string } | null)?.message ?? null };
}

/**
 * The booking as it stood before an edit.
 *
 * It arrives as the whole row now that `update_booking_returning_previous`
 * hands it back, rather than the hand-written column list this used to keep in
 * step with the payload — a list that went stale the moment either side gained
 * a field.
 */
type EditedColumns = Partial<UpdateBookingPayload>;

/**
 * One line per thing the person at the desk actually did.
 *
 * A single save can move a session, hand it to somebody else and correct the
 * client's phone number, and each of those is a different question a reader of
 * the history is trying to answer — but a save that touches six fields of the
 * address is still one edit. So the moves that have their own vocabulary get
 * their own entry, and everything else is gathered into one `edited`.
 *
 * The comparison is the same one the client's email and the professional's
 * WhatsApp are decided by, applied to the row as stored rather than to the copy
 * the screen loaded — if somebody else moved the booking in the meantime, the
 * history is right about what this save changed.
 */
async function recordBookingEdit(
  bookingId: string,
  before: EditedColumns,
  after: UpdateBookingPayload,
  actor: AuthContext,
): Promise<void> {
  const base = {
    bookingId,
    channel: "system" as const,
    actorId: actor.userId,
    actorRole: actor.role as BookingEventActorRole,
  };
  const entries: BookingEventInput[] = [];

  const statusChanged = after.status !== before.status;
  // Confirming and cancelling are the two the history has words of its own for;
  // any other change of state is just another edited field.
  const statusIsItsOwnEvent =
    statusChanged &&
    (after.status === "confirmed" || after.status === "cancelled");
  if (statusIsItsOwnEvent) {
    entries.push({
      ...base,
      event: after.status === "confirmed" ? "confirmed" : "cancelled",
      summary:
        after.status === "confirmed"
          ? "Reserva confirmada"
          : "Reserva cancelada",
      payload: {
        status: { before: before.status ?? null, after: after.status },
      },
    });
  }

  const dateTimeChanged =
    after.date !== (before.date ?? null) ||
    (after.time ?? "") !== (before.time ?? "");
  if (dateTimeChanged) {
    entries.push({
      ...base,
      event: "rescheduled",
      summary: `Hora cambiada de ${humanMoment(before.date, before.time)} a ${humanMoment(after.date, after.time)}`,
      payload: {
        date: { before: before.date ?? null, after: after.date },
        time: { before: before.time ?? null, after: after.time },
      },
    });
  }

  // `staff_id` is optional on the payload, and a caller that omits it is not
  // saying the booking has nobody — it is saying it did not touch that.
  const staffChanged =
    after.staff_id !== undefined &&
    (after.staff_id ?? "") !== (before.staff_id ?? "");
  if (staffChanged) {
    const names = await staffFirstNames([before.staff_id, after.staff_id]);
    const from = before.staff_id ? (names.get(before.staff_id) ?? "—") : null;
    const to = after.staff_id ? (names.get(after.staff_id) ?? "—") : null;
    entries.push({
      ...base,
      // A swap is an assignment: somebody holds this booking now.
      event: to ? "assigned" : "unassigned",
      summary: to
        ? from
          ? `Profesional cambiado de ${from} a ${to}`
          : `Profesional asignado: ${to}`
        : `Profesional retirado: ${from}`,
      payload: {
        staffId: {
          before: before.staff_id ?? null,
          after: after.staff_id ?? null,
        },
      },
    });
  }

  // Everything the vocabulary above has no word for, named once.
  const changed: string[] = [];
  const rest: Record<string, unknown> = {};
  const note = (label: string, field: string, was: unknown, now: unknown) => {
    if (was === now) return;
    if (!changed.includes(label)) changed.push(label);
    rest[field] = { before: was ?? null, after: now ?? null };
  };

  note("servicio", "service_id", before.service_id, after.service_id);
  note("servicio", "service_title", before.service_title, after.service_title);
  // The duration comes from the session type, so a change of one is a change of
  // the other and naming both would read as two edits.
  note("tipo de sesión", "tier_id", before.tier_id ?? null, after.tier_id);
  note("tipo de sesión", "duration", before.duration ?? null, after.duration);
  // A `numeric` column can come back as `"45.00"` where the payload writes 45,
  // and compared as they are that would report a price change on every save.
  const priceBefore =
    before.price_eur == null ? null : Number(before.price_eur);
  note("precio", "price_eur", priceBefore, after.price_eur);
  note("lugar", "location", before.location ?? null, after.location);
  note(
    "lugar",
    "location_address",
    before.location_address ?? null,
    after.location_address,
  );
  note("notas", "notes", before.notes ?? null, after.notes);
  note("datos del cliente", "first_name", before.first_name, after.first_name);
  note("datos del cliente", "last_name", before.last_name, after.last_name);
  note("datos del cliente", "email", before.email, after.email);
  note("datos del cliente", "phone", before.phone ?? null, after.phone);
  // Back to `pending`, say: a real change of state with no entry of its own.
  if (statusChanged && !statusIsItsOwnEvent) {
    note("estado", "status", before.status, after.status);
  }

  if (changed.length > 0) {
    entries.push({
      ...base,
      event: "edited",
      summary: `Reserva editada: ${changed.join(", ")}`,
      payload: rest,
    });
  }

  // One insert, so a save never shows up half-recorded.
  await recordBookingEvents(entries);
}

/** Full booking edit from the dashboard. Staff only. */
export async function updateBookingByAdmin(
  accessToken: string | null,
  bookingId: string,
  payload: UpdateBookingPayload,
): Promise<{ error: string | null }> {
  let actor: AuthContext;
  try {
    actor = await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!bookingId) return { error: "Falta el identificador de la reserva." };

  const db = getAdminClient().database;

  // One call that writes the row and returns what it was.
  //
  // The history has to say what the session was moved *from*, and that value is
  // gone the instant the update lands — which is why this used to be a read
  // followed by a write, one waiting on the other. They are not independent
  // work that happens to be sequential: they are the same row, and racing them
  // would let the read land after the write and report "de las 16:00 a las
  // 16:00". `update_booking_returning_previous` settles both in one statement,
  // under `FOR UPDATE`, so the trip is halved and two people saving at once can
  // no longer read the same "before".
  const { data: before, error } = await db.rpc(
    "update_booking_returning_previous",
    { p_id: bookingId, p_payload: payload },
  );

  if (error) {
    return { error: (error as { message?: string }).message ?? null };
  }

  if (before) {
    try {
      await recordBookingEdit(
        bookingId,
        before as EditedColumns,
        payload,
        actor,
      );
    } catch {
      // fail-open: resolving the professionals' names is a second request, and
      // a booking that saved must not come back as an error because the line
      // describing it could not be written.
    }
  }

  return { error: null };
}
