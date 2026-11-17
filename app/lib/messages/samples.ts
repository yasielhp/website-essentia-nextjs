import { bonusPurchaseEmail } from "@/emails/templates/bonus-purchase";
import { bookingCancelledEmail } from "@/emails/templates/booking-cancelled";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { bookingConfirmedEmail } from "@/emails/templates/booking-confirmed";
import { bookingReceivedEmail } from "@/emails/templates/booking-received";
import { bookingReminderEmail } from "@/emails/templates/booking-reminder";
import { bookingRescheduledEmail } from "@/emails/templates/booking-rescheduled";
import { consentRequestEmail } from "@/emails/templates/consent-request";
import type { CampaignLocale } from "@/types/campaign";
import { formatPrice } from "@/utils/format";
import type { MessageKey } from "./catalog";
import type { FixedBlocksData } from "./fixed-blocks";
import type { MessageVars } from "./compose";

/**
 * Example data for "send me a test": one booking, in one language, shaped the
 * way each message prints its own values today (a date with the weekday for
 * the booking emails and without it for the paid confirmation, an amount with
 * the currency on the language's side).
 *
 * Every link is an `example.com` address, so a test email can never be mistaken
 * for a real booking nor lead anywhere. Pure.
 */

const NAME = "Ana";
const DATE_ISO = "2026-08-20";
const CANCEL_URL = "https://example.com/cancel?token=sample";
const CONSENT_URL = "https://example.com/consent?token=sample";

const TEXT = {
  es: {
    service: "Drenaje linfático",
    sessionType: "Sesión individual",
    date: "jueves, 20 de agosto de 2026",
    // The paid confirmation has never printed the weekday.
    paidDate: "20 de agosto de 2026",
    time: "10:30",
    duration: "60 min",
    expiresOn: "20 de agosto de 2027",
  },
  en: {
    service: "Lymphatic drainage",
    sessionType: "Single session",
    date: "Thursday, 20 August 2026",
    paidDate: "20 August 2026",
    time: "10:30",
    duration: "60 min",
    expiresOn: "20 August 2027",
  },
} as const;

/** What the request-received email prints for what is owed: "45 €" / "€45". */
const owedAtCentre = (eur: number, locale: CampaignLocale) =>
  locale === "es" ? `${eur} €` : `€${eur}`;

const PAID_EUR = 20;
const OWED_EUR = 25;
const DUE_AT_CENTRE_EUR = 45;
const BONUS_SESSIONS = 5;
const BONUS_EUR = 180;

export function sampleVars(
  key: MessageKey,
  locale: CampaignLocale,
): MessageVars {
  const t = TEXT[locale];
  const booking = {
    first_name: NAME,
    service: t.service,
    session_type: t.sessionType,
    date: t.date,
    time: t.time,
    duration: t.duration,
  };
  switch (key) {
    case "booking_received":
      return {
        ...booking,
        amount_due: owedAtCentre(DUE_AT_CENTRE_EUR, locale),
        cancel_url: CANCEL_URL,
      };
    case "booking_confirmed":
      return { ...booking, cancel_url: CANCEL_URL, consent_url: CONSENT_URL };
    case "booking_paid":
      return {
        first_name: NAME,
        service: t.service,
        date: t.paidDate,
        time: t.time,
        duration: t.duration,
        amount_paid: formatPrice(PAID_EUR, locale),
        amount_due: formatPrice(OWED_EUR, locale),
        consent_url: CONSENT_URL,
      };
    case "booking_rescheduled":
    case "booking_reminder":
      return { ...booking, cancel_url: CANCEL_URL };
    case "booking_cancelled":
      return booking;
    case "consent_request":
      return { first_name: NAME, consent_url: CONSENT_URL };
    case "bonus_purchase":
      return {
        first_name: NAME,
        service: t.sessionType,
        sessions: String(BONUS_SESSIONS),
        amount_paid: formatPrice(BONUS_EUR, locale),
        expires_on: t.expiresOn,
      };
  }
}

/** The data behind the fixed blocks of the same sample. */
export function sampleFixed(
  key: MessageKey,
  locale: CampaignLocale,
): FixedBlocksData {
  const t = TEXT[locale];
  const base: FixedBlocksData = {
    locale,
    service: t.service,
    sessionType: t.sessionType,
    date: t.date,
    time: t.time,
    duration: t.duration,
    dateIso: DATE_ISO,
    cancelUrl: CANCEL_URL,
    consentUrl: CONSENT_URL,
  };
  switch (key) {
    case "booking_received":
      return { ...base, consentUrl: null, amountDueEur: DUE_AT_CENTRE_EUR };
    case "booking_paid":
      return {
        ...base,
        sessionType: null,
        date: t.paidDate,
        cancelUrl: null,
        paidEur: PAID_EUR,
        owedEur: OWED_EUR,
      };
    case "booking_rescheduled":
    case "booking_reminder":
      return { ...base, consentUrl: null };
    case "booking_cancelled":
      return { ...base, cancelUrl: null, consentUrl: null };
    case "consent_request":
      return { ...base, cancelUrl: null };
    case "bonus_purchase":
      return {
        ...base,
        service: t.sessionType,
        cancelUrl: null,
        consentUrl: null,
        bonus: {
          sessions: BONUS_SESSIONS,
          amount: formatPrice(BONUS_EUR, locale),
          expiresOn: t.expiresOn,
        },
      };
    case "booking_confirmed":
      return base;
  }
}

/** The email that has always gone out for this message, with the sample data. */
export function legacySampleEmail(
  key: MessageKey,
  locale: CampaignLocale,
): string {
  const t = TEXT[locale];
  const booking = {
    name: NAME,
    service: t.service,
    sessionType: t.sessionType,
    date: t.date,
    time: t.time,
    duration: t.duration,
    locale,
  };
  switch (key) {
    case "booking_received":
      return bookingReceivedEmail({
        ...booking,
        amountDueEur: DUE_AT_CENTRE_EUR,
        cancelUrl: CANCEL_URL,
      });
    case "booking_confirmed":
      return bookingConfirmedEmail({
        ...booking,
        dateIso: DATE_ISO,
        cancelUrl: CANCEL_URL,
        consentUrl: CONSENT_URL,
      });
    case "booking_paid":
      return bookingConfirmationEmail({
        name: NAME,
        serviceName: t.service,
        date: t.paidDate,
        time: t.time,
        duration: t.duration,
        dateIso: DATE_ISO,
        locale,
        paidEur: PAID_EUR,
        owedEur: OWED_EUR,
        consentUrl: CONSENT_URL,
      });
    case "booking_rescheduled":
      return bookingRescheduledEmail({
        ...booking,
        dateIso: DATE_ISO,
        cancelUrl: CANCEL_URL,
      });
    case "booking_cancelled":
      return bookingCancelledEmail(booking);
    case "booking_reminder":
      return bookingReminderEmail({
        ...booking,
        dateIso: DATE_ISO,
        cancelUrl: CANCEL_URL,
      });
    case "consent_request":
      return consentRequestEmail({ name: NAME, url: CONSENT_URL, locale });
    case "bonus_purchase":
      return bonusPurchaseEmail({
        name: NAME,
        service: t.sessionType,
        sessions: BONUS_SESSIONS,
        amount: formatPrice(BONUS_EUR, locale),
        expiresOn: t.expiresOn,
        locale,
      });
  }
}
