"use client";

import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import {
  updateDraftBookingMeta,
  updateDraftBookingDetails,
  confirmDraftBooking,
} from "@/actions/booking-draft";
import { notifyBooking } from "@/actions/booking-notifications";
import { updateNewsletterForUser } from "@/actions/newsletter";
import { localDateStr } from "@/utils/format";
import type { DetailsState } from "@/types";
import type { BookableService } from "@/data/services-data";
import type { PaymentMethod } from "./steps/confirm-step";
import type { RedsysFormData } from "./steps/payment-overlay";

/**
 * The three writes the public booking form makes, away from the markup.
 *
 * Each carries rules learned the hard way — a draft that must be reused rather
 * than duplicated, a contact link whose failure must be loud but must not cost
 * somebody their appointment, a price that depends on when they pay. They are
 * here so those rules are readable without scrolling past a form.
 */

/** What the form knows by the time it can write anything. */
type Draft = {
  service: BookableService | null;
  tierId: string | null;
  tierLabel: string | null;
  tierPrice: number | null;
  tierPriceOnline: number | null;
  duration: string | null;
  staffId: string | null;
  date: Date | null;
  time: string | null;
  details: DetailsState;
  paymentMethod: PaymentMethod;
};

type Viewer = { id: string } | null;

export type DetailsStepResult =
  /** The address belongs to a member, who should sign in rather than book as a guest. */
  | { kind: "member" }
  | { kind: "saved"; contactId: string | null; bookingId: string | null };

/**
 * Saves who the booking is for, and starts or updates the draft.
 *
 * This step can run more than once — back and forward through the flow, or a
 * corrected typo — and each run used to create another draft. The one this
 * visit already started is reused.
 */
export async function saveDetailsStep({
  user,
  locale,
  draft,
  contactId,
  bookingId,
}: {
  user: Viewer;
  locale: string;
  draft: Draft;
  contactId: string | null;
  bookingId: string | null;
}): Promise<DetailsStepResult> {
  const { details, service } = draft;
  let resolvedContactId = contactId;

  if (!user) {
    const { data: roleData } = await insforge.database.rpc("check_email_role", {
      p_email: details.email,
    });

    if (roleData === "member") return { kind: "member" };

    const { data: contactUuid, error: contactError } =
      await insforge.database.rpc("upsert_contact", {
        p_email: details.email,
        p_first_name: details.firstName,
        p_last_name: details.lastName,
        p_phone: details.phone,
        p_language: locale,
        p_gender: details.gender || null,
        // `null`, not `false`: an unticked box must not undo a yes given before.
        p_newsletter: details.newsletter ? true : null,
      });

    // Never swallow this. A failure here used to pass unnoticed and the draft
    // was written with no contact attached, which is how orphaned drafts — and
    // missing leads — accumulated. The booking still proceeds, because a
    // bookkeeping problem must not cost a customer their appointment, but it is
    // recorded loudly enough to be found.
    if (contactError || !contactUuid) {
      console.error(
        "[booking] upsert_contact failed; the draft will have no contact:",
        contactError ?? "no id returned",
      );
    } else {
      resolvedContactId = contactUuid as string;
    }
  }

  // A signed-in client has no contact row to upsert here, so the preference
  // goes through the account path. Best effort: a booking is worth more than
  // a newsletter flag.
  if (user && details.newsletter) {
    void updateNewsletterForUser(
      getAccessToken(),
      user.id,
      details.email,
      true,
    ).catch(() => undefined);
  }

  let draftId = bookingId;

  if (draftId) {
    await updateDraftBookingDetails(draftId, {
      contactId: resolvedContactId ?? null,
      userId: user?.id ?? null,
      serviceId: service?.id ?? "",
      serviceTitle: service?.title ?? "",
      duration: draft.duration ?? "",
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      phone: details.phone,
    });
  } else {
    const { data: newBookingId } = await insforge.database.rpc(
      "create_draft_booking",
      {
        p_contact_id: resolvedContactId ?? null,
        p_user_id: user?.id ?? null,
        p_service_id: service?.id ?? "",
        p_service_title: service?.title ?? "",
        p_duration: draft.duration ?? "",
        p_first_name: details.firstName,
        p_last_name: details.lastName,
        p_email: details.email,
        p_phone: details.phone,
      },
    );
    if (newBookingId) draftId = newBookingId as string;
  }

  if (draftId) {
    await updateDraftBookingMeta(
      draftId,
      draft.tierId,
      draft.tierPrice,
      user?.id ?? null,
      user?.id ? "client" : "anonymous",
      details.notes?.trim() || null,
      draft.staffId,
      draft.paymentMethod,
    );
  }

  return { kind: "saved", contactId: resolvedContactId, bookingId: draftId };
}

/** Records the chosen day and hour on the draft, if there is one yet. */
export async function saveDatetimeStep(
  bookingId: string | null,
  date: Date | null,
  time: string | null,
): Promise<void> {
  if (!bookingId || !date || !time) return;
  await insforge.database.rpc("update_booking_datetime", {
    p_booking_id: bookingId,
    p_date: localDateStr(date),
    p_time: time,
  });
}

export type ConfirmResult =
  /** The booking stands; the money is taken on the day. */
  | { kind: "on-site" }
  /** Hand over to Redsys with this form. */
  | { kind: "redsys"; formData: RedsysFormData }
  /** Payment could not be started; the booking stands and is chased later. */
  | { kind: "unpaid" };

/**
 * Turns the draft into a booking, tells everyone, and decides where the visitor
 * goes next.
 *
 * Navigation is the caller's: this returns what happened rather than pushing a
 * route, so the order of writes stays readable in one place.
 */
export async function confirmBooking({
  user,
  locale,
  draft,
  contactId,
  bookingId,
  paymentDescription,
}: {
  user: Viewer;
  locale: string;
  draft: Draft;
  contactId: string | null;
  bookingId: string | null;
  /** The service name as the card statement should read it. */
  paymentDescription: string;
}): Promise<ConfirmResult> {
  const { service, tierId, details, paymentMethod } = draft;
  if (!service || !tierId) return { kind: "unpaid" };

  const dateStr = draft.date ? localDateStr(draft.date) : null;
  const timeStr = draft.time ?? null;

  let resolvedBookingId = bookingId;
  if (resolvedBookingId) {
    await confirmDraftBooking(
      resolvedBookingId,
      tierId,
      draft.tierPrice,
      draft.duration ?? "",
      dateStr ?? "",
      timeStr ?? "",
    );
  } else {
    const composedNotes = details.notes?.trim() || null;
    const { data } = await insforge.database
      .from("bookings")
      .insert([
        {
          ...(user?.id ? { user_id: user.id } : {}),
          ...(contactId ? { contact_id: contactId } : {}),
          service_id: service.id,
          service_title: service.title,
          tier_id: tierId,
          ...(draft.staffId ? { staff_id: draft.staffId } : {}),
          // What this booking will actually be charged, which is the online
          // price when they pay now and the centre price when they don't.
          price_eur:
            paymentMethod === "online"
              ? (draft.tierPriceOnline ?? draft.tierPrice)
              : draft.tierPrice,
          duration: draft.duration ?? "",
          location: "centro",
          ...(composedNotes ? { notes: composedNotes } : {}),
          ...(dateStr ? { date: dateStr } : {}),
          ...(timeStr ? { time: timeStr } : {}),
          first_name: details.firstName,
          last_name: details.lastName,
          email: details.email,
          phone: details.phone,
          status: "pending",
          ...(user?.id
            ? { created_by_user_id: user.id, created_by_role: "client" }
            : { created_by_role: "anonymous" }),
        },
      ])
      .select("id")
      .single();
    resolvedBookingId = (data as { id: string } | null)?.id ?? null;
  }

  if (contactId) {
    // Through a function, not a direct update: the open UPDATE policy this
    // relied on let anyone rewrite any contact. It also only ever promotes a
    // lead — the previous `.neq("status", "client")` still demoted a member to
    // client the moment they booked.
    const { error: promoteError } = await insforge.database.rpc(
      "promote_contact_to_client",
      { p_contact_id: contactId },
    );
    if (promoteError) {
      console.error(
        "[booking] promote_contact_to_client failed; the contact stays a lead:",
        promoteError,
      );
    }
  }

  // "Received" reaches the client and the centre as soon as the booking exists,
  // without waiting: an email is not worth delaying the payment screen for.
  if (resolvedBookingId && details.email && dateStr) {
    notifyBooking(getAccessToken(), {
      bookingId: resolvedBookingId,
      event: "received",
      clientName: `${details.firstName} ${details.lastName}`.trim(),
      clientEmail: details.email,
      clientPhone: details.phone || null,
      service: service.title,
      serviceId: service.id,
      sessionType: draft.tierLabel,
      amountDueEur: paymentMethod === "on-site" ? draft.tierPrice : null,
      date: dateStr,
      time: timeStr ?? "",
      duration: draft.duration ?? null,
      locale: locale as "en" | "es",
    }).catch(() => {});
  }

  if (paymentMethod === "on-site") return { kind: "on-site" };

  const res = await fetch("/api/checkout/booking-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId: resolvedBookingId ?? "",
      tierId,
      email: details.email,
      name: `${details.firstName} ${details.lastName}`.trim(),
      description: paymentDescription,
      date: dateStr ?? undefined,
      time: timeStr ?? undefined,
      phone: details.phone || undefined,
    }),
  });

  // The booking is already saved. If the payment session cannot be opened the
  // visitor is not sent back into the form — the centre chases the money.
  if (!res.ok) return { kind: "unpaid" };

  return { kind: "redsys", formData: (await res.json()) as RedsysFormData };
}
