"use client";

import { getAccessToken } from "@/lib/client-session";
import {
  confirmPublicBooking,
  savePublicDraft,
  setPublicDraftTime,
} from "@/actions/public-booking";
import { savePublicContact } from "@/actions/public-contact";
import { notifyBooking } from "@/actions/booking-notifications";
import { saveBookingConsents } from "@/actions/whatsapp-consent";
import {
  bookingForSomeoneElse,
  marketingChoice,
  sendBookingConsents,
} from "./booking-consent";
import { bookingDetailsSchema, parseErrors } from "@/lib/schemas";
import { localDateStr } from "@/utils/format";
import type { DetailsState } from "@/types";
import type { BookableService } from "@/data/services-data";
import type { RedsysFormData } from "./steps/payment-overlay";

/**
 * The three writes the public booking form makes, away from the markup.
 *
 * Each carries rules learned the hard way — a draft that must be reused rather
 * than duplicated, a contact link whose failure must be loud but must not cost
 * somebody their appointment, a price the server reads from the tier and
 * never from the form. They are here so those rules are readable without
 * scrolling past a form.
 *
 * Nothing here writes `bookings`. The draft, its day and hour, and the booking
 * itself are written by the server (`app/actions/public-booking.ts`), which
 * takes only what the visitor chose and decides the status, the price, the
 * payment and the account from her verified session. The browser's key can
 * no longer write the table (migration `20261124_bookings_close_browser_writes`).
 *
 * Nor does anything here reach the database with the browser's key at all.
 * The member check and the contact are a server action too
 * (`app/actions/public-contact.ts`), and so is turning a lead into a client
 * (the last step's own action does it): the functions they used,
 * `check_email_role`, `upsert_contact` and `promote_contact_to_client`, are
 * the service key's alone (migration
 * `20261124_revoke_public_definer_functions`).
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
  // verified session. The step has the server write the contact of a guest,
  // and of the person a signed-in caller is booking FOR when the form carries
  // another address than hers: that name and that phone are not the caller's,
  // and must not land on her contact.
  const forSomeoneElse =
    user !== null && bookingForSomeoneElse(user.email, details.email);

  if (!user || forSomeoneElse) {
    // One call, on the server: whether the address is a member's (somebody
    // who is signed in is not asked to sign in, nor is a member who already
    // chose to go on as a guest), and if not, her contact. The answer about
    // the address is "member" or not, never its role.
    const contact = await savePublicContact({
      email: details.email,
      firstName: details.firstName,
      lastName: details.lastName,
      phone: details.phone,
      language: locale === "es" ? "es" : "en",
      gender: details.gender || null,
      // One box, both channels, `null` when unticked (see booking-consent.ts).
      marketing: marketingChoice(details),
      checkMember: !user && !asGuest,
    }).catch(() => ({ kind: "failed" as const }));

    if (contact.kind === "member") return { kind: "member" };

    // Never swallow this. A failure here used to pass unnoticed and the draft
    // was written with no contact attached, which is how orphaned drafts — and
    // missing leads — accumulated. The booking still proceeds, because a
    // bookkeeping problem must not cost a customer their appointment, but it is
    // recorded loudly enough to be found (the reason only, never her details).
    if (contact.kind === "saved") {
      resolvedContactId = contact.contactId;
    } else {
      console.error(
        "[booking] the contact could not be saved; the draft will have no contact:",
        contact.kind,
      );
    }
  }

  // One call, on the server: it starts the draft or rewrites this visit's own,
  // and decides everything she did not choose. A failure costs her nothing
  // here: the last step writes the booking afresh when there is no draft.
  const saved = await savePublicDraft(getAccessToken(), {
    draftId: bookingId,
    contactId: resolvedContactId ?? null,
    serviceId: service?.id ?? "",
    tierId: draft.tierId,
    staffId: draft.staffId,
    firstName: details.firstName,
    lastName: details.lastName,
    email: details.email,
    phone: details.phone,
    notes: details.notes?.trim() || null,
  });
  if (!saved.ok) {
    console.error("[booking] the draft could not be saved:", saved.error);
  }
  const draftId = saved.ok ? saved.bookingId : bookingId;

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
  await setPublicDraftTime({
    draftId: bookingId,
    date: localDateStr(date),
    time,
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
  /**
   * The booking was already confirmed somewhere else (another tab, an earlier
   * visit): no payment is opened on it from this form.
   */
  | { kind: "alreadyConfirmed" }
  /** Hand over to Redsys with this form. */
  | { kind: "redsys"; formData: RedsysFormData }
  /**
   * The booking is paid already (a second tab, the back button after paying):
   * no new charge was opened, and she is shown it as paid.
   */
  | { kind: "alreadyPaid" }
  /**
   * The professional's hour was taken by another booking a moment ago (the
   * database refused it): nothing was charged, and she picks another hour.
   */
  | { kind: "slotTaken" }
  /**
   * The booking could not be confirmed (the database did not answer, or the
   * server did not take what was sent): nothing is charged and she may try
   * again from the same step.
   */
  | { kind: "failed" }
  /**
   * Too many attempts from her address, or too many bookings of hers already
   * waiting for their payment: nothing is charged; she is asked to wait.
   */
  | { kind: "busy" }
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
  locale,
  draft,
  contactId,
  bookingId,
  promotedHere = false,
  paymentDescription,
}: {
  locale: string;
  draft: Draft;
  contactId: string | null;
  bookingId: string | null;
  /**
   * This visit has already turned `bookingId` from a draft into a booking (she
   * closed the payment page and is confirming again). It is hers and it is
   * pending, so it is not asked to be confirmed a second time.
   */
  promotedHere?: boolean;
  /** The service name as the card statement should read it. */
  paymentDescription: string;
}): Promise<ConfirmResult> {
  const { service, tierId, details } = draft;
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
  if (!promotedHere || !resolvedBookingId) {
    // The server writes the booking: her draft promoted, or a booking afresh
    // when she has none. It takes what she chose and nothing else.
    const answer = await confirmPublicBooking(getAccessToken(), {
      draftId: resolvedBookingId,
      contactId,
      serviceId: service.id,
      tierId,
      staffId: draft.staffId,
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      phone: details.phone,
      notes: details.notes?.trim() || null,
      date: dateStr ?? "",
      time: timeStr ?? "",
    });
    switch (answer.kind) {
      case "promoted":
      case "created":
        resolvedBookingId = answer.bookingId;
        break;
      // It is a booking already, and this call is not the one that made it
      // so: confirmed in another tab, or on an earlier visit. Opening a
      // payment on it from here could charge for a day, an hour or a
      // treatment that is not the one it was confirmed with.
      case "not_draft":
        return { kind: "alreadyConfirmed" };
      // Somebody else's booking took the professional's hour a moment ago.
      // No payment is opened for an hour she cannot have.
      case "slot_taken":
        return { kind: "slotTaken" };
      // Nothing was confirmed: the checkout opens only on a booking that is
      // waiting for its payment, so no payment is opened either.
      case "failed":
      case "invalid":
        return { kind: "failed" };
      case "rate_limited":
      case "too_many_pending":
        return { kind: "busy" };
    }
  }

  const res = await fetch("/api/checkout/booking-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The session type and the price are the booking's own, read on the
    // server; the claim cookie of this browser goes with the request.
    credentials: "same-origin",
    body: JSON.stringify({
      bookingId: resolvedBookingId ?? "",
      email: details.email,
      name: `${details.firstName} ${details.lastName}`.trim(),
      description: paymentDescription,
      date: dateStr ?? undefined,
      time: timeStr ?? undefined,
      phone: details.phone || undefined,
    }),
  });

  // Paid already: the checkout opened nothing, and the visitor is told it is
  // paid rather than sent to the "unpaid" page.
  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as {
      code?: string;
    } | null;
    if (body?.code === "already_paid") return { kind: "alreadyPaid" };
  }

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
