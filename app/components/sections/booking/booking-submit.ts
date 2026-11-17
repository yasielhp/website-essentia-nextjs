"use client";

import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import {
  updateDraftBookingMeta,
  updateDraftBookingDetails,
  confirmDraftBooking,
} from "@/actions/booking-draft";
import { notifyBooking } from "@/actions/booking-notifications";
import { saveBookingConsents } from "@/actions/whatsapp-consent";
import {
  bookingForSomeoneElse,
  contactConsentArgs,
  sendBookingConsents,
} from "./booking-consent";
import { bookingDetailsSchema, parseErrors } from "@/lib/schemas";
import { localDateStr } from "@/utils/format";
import type { DetailsState } from "@/types";
import type { BookableService } from "@/data/services-data";
import type { PaymentMode } from "@/lib/payments/amounts";
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
  paymentMode: PaymentMode;
};

/** The signed-in caller, with the address of her session as the browser knows it. */
type Viewer = { id: string; email?: string | null } | null;

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
  asGuest = false,
}: {
  user: Viewer;
  locale: string;
  draft: Draft;
  contactId: string | null;
  bookingId: string | null;
  /**
   * The visitor has already been told the address belongs to a member and
   * chose to go on without signing in. She is not asked twice, and from here on
   * she is saved like any other guest: her contact, her draft, her consents.
   */
  asGuest?: boolean;
}): Promise<DetailsStepResult> {
  const { details, service } = draft;
  let resolvedContactId = contactId;

  // A signed-in client's own contact is written on the server, from her
  // verified session. The browser writes the contact of a guest, and of the
  // person a signed-in caller is booking FOR when the form carries another
  // address than hers: that name and that phone are not the caller's, and
  // must not land on her contact.
  const forSomeoneElse =
    user !== null && bookingForSomeoneElse(user.email, details.email);

  if (!user || forSomeoneElse) {
    // Somebody who is signed in is not asked to sign in.
    if (!user && !asGuest) {
      const { data: roleData } = await insforge.database.rpc(
        "check_email_role",
        { p_email: details.email },
      );

      if (roleData === "member") return { kind: "member" };
    }

    const { data: contactUuid, error: contactError } =
      await insforge.database.rpc("upsert_contact", {
        p_email: details.email,
        p_first_name: details.firstName,
        p_last_name: details.lastName,
        p_phone: details.phone,
        p_language: locale,
        p_gender: details.gender || null,
        // One box, both channels, `null` when unticked (see booking-consent.ts).
        ...contactConsentArgs(details),
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
      draft.paymentMode,
    );
  }

  // What follows the contact: for a guest the notice consent, for a signed-in
  // client her contact, her choice on news and offers, and the notice consent.
  // All of it is ONE server action, which answers within three seconds
  // whatever the database does (`saveBookingConsents`).
  //
  // It goes LAST and is not awaited, on purpose. Next runs a page's server
  // actions one at a time, in the order they were called, so this one takes a
  // single turn of that queue, after the draft above, and can hold up what
  // comes after the step (the calendar's availability) for those three seconds
  // at most. The client moves on at once. The only cost of a lost write is a
  // WhatsApp notice that is not sent; nothing here may fail the booking.
  void sendBookingConsents({
    user,
    locale,
    details,
    effects: {
      getAccessToken,
      saveBookingConsents,
      log: (message, detail) => console.error(message, detail),
    },
  });

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
  /**
   * Her details are not in order (the terms box unticked, most of all), so
   * nothing was written: back to the details step with these errors.
   */
  | {
      kind: "incomplete";
      errors: Partial<Record<keyof DetailsState, string>>;
    }
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
  const { service, tierId, details, paymentMode } = draft;
  if (!service || !tierId) return { kind: "unpaid" };

  // The last gate. The details step checks this before letting her through,
  // but the confirmation is where the booking and the payment happen, so it
  // does not take that on trust: the required box is the acceptance of the
  // Terms and the consent to the booking notices, and a form that reached this
  // point some other way (a restored visit, a step skipped) must not go on to
  // the payment without it.
  const errors = parseErrors(bookingDetailsSchema, details);
  if (Object.keys(errors).length > 0) return { kind: "incomplete", errors };

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
          // The web price; the checkout lowers it when they pay everything now
          // and the settings give a discount for that.
          price_eur: draft.tierPriceOnline ?? draft.tierPrice,
          payment_mode: paymentMode,
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
      paymentMode,
    }),
  });

  // The booking is already saved. If the payment session cannot be opened the
  // visitor is not sent back into the form; the unpaid booking is released by
  // the expiry cron if nobody completes it.
  if (!res.ok) return { kind: "unpaid" };

  // "Received" reaches the client once the payment is open, without waiting:
  // an email is not worth delaying the payment screen for. The centre is told
  // separately, when the money arrives.
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
      amountDueEur: null,
      date: dateStr,
      time: timeStr ?? "",
      duration: draft.duration ?? null,
      locale: locale as "en" | "es",
    }).catch(() => {});
  }

  return { kind: "redsys", formData: (await res.json()) as RedsysFormData };
}
