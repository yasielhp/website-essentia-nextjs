import type { MessageKey } from "@/lib/messages/catalog";
import type { FixedBlocksData } from "@/lib/messages/fixed-blocks";
import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import { bonusPurchaseEmail } from "../templates/bonus-purchase";
import { bookingCancelledEmail } from "../templates/booking-cancelled";
import { bookingConfirmationEmail } from "../templates/booking-confirmation";
import { bookingConfirmedEmail } from "../templates/booking-confirmed";
import { bookingReceivedEmail } from "../templates/booking-received";
import { bookingReminderEmail } from "../templates/booking-reminder";
import { bookingRescheduledEmail } from "../templates/booking-rescheduled";
import { consentRequestEmail } from "../templates/consent-request";

/**
 * Sample data and the legacy email for every message, language and variant
 * (prepaid or pay at the centre, consent pending or signed, deposit or paid in
 * full; a deposit is only ever a booking made before 2026-11-24). Shared by the tests that compare the code's own blocks and defaults
 * with what the legacy templates really produce. Test support only.
 */

export const SAMPLE = {
  es: {
    name: "Ana García",
    service: "Drenaje linfático",
    sessionType: "Sesión individual",
    date: "jueves, 20 de agosto de 2026",
    time: "10:30",
    duration: "60 min",
  },
  en: {
    name: "Ana García",
    service: "Lymphatic drainage",
    sessionType: "Single session",
    date: "Thursday, 20 August 2026",
    time: "10:30",
    duration: "60 min",
  },
} as const;

const DATE_ISO = "2026-08-20";
const CANCEL = "https://example.test/cancel?token=abc";
const CONSENT = "https://example.test/consent?token=abc";

// ── visible text ───────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&mdash;": "—",
  "&nbsp;": " ",
};

export function visibleText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|mdash|nbsp);/g, (m) => ENTITIES[m]!)
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const squash = (text: string) => text.replace(/\s+/g, " ").trim();

export function docParagraphs(doc: EmailDoc | null): string[] {
  const textOf = (node: EmailDoc): string => {
    if (node.type === "hardBreak") return " ";
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map(textOf).join("");
  };
  return (doc?.content ?? []).map((node) => squash(textOf(node)));
}

export function fill(text: string, values: Record<string, string>): string {
  return squash(
    text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, name: string) => {
      const value = values[name];
      if (value === undefined) throw new Error(`no sample for {{${name}}}`);
      return value;
    }),
  );
}

// ── one legacy case: the email, the data behind it, and the variables ──────

export type Case = {
  label: string;
  legacy: string;
  fixed: FixedBlocksData;
  values: Record<string, string>;
};

export function casesFor(key: MessageKey, locale: CampaignLocale): Case[] {
  const s = SAMPLE[locale];
  const base = {
    locale,
    service: s.service,
    sessionType: s.sessionType,
    date: s.date,
    time: s.time,
    duration: s.duration,
  };
  const common = {
    first_name: s.name,
    service: s.service,
    session_type: s.sessionType,
    date: s.date,
    time: s.time,
    duration: s.duration,
  };

  switch (key) {
    case "booking_received":
      return [null, 45].map((due) => ({
        label: due == null ? "prepaid" : "pay at the centre",
        legacy: bookingReceivedEmail({
          name: s.name,
          service: s.service,
          sessionType: s.sessionType,
          date: s.date,
          time: s.time,
          duration: s.duration,
          amountDueEur: due,
          cancelUrl: CANCEL,
          locale,
        }),
        fixed: { ...base, amountDueEur: due, cancelUrl: CANCEL },
        values: {
          ...common,
          amount_due: due == null ? "" : String(due),
          cancel_url: CANCEL,
        },
      }));
    case "booking_confirmed":
      return [CONSENT, null].map((consentUrl) => ({
        label: consentUrl ? "with consent" : "consent signed",
        legacy: bookingConfirmedEmail({
          name: s.name,
          service: s.service,
          sessionType: s.sessionType,
          date: s.date,
          time: s.time,
          duration: s.duration,
          dateIso: DATE_ISO,
          cancelUrl: CANCEL,
          consentUrl,
          locale,
        }),
        fixed: { ...base, dateIso: DATE_ISO, cancelUrl: CANCEL, consentUrl },
        values: {
          ...common,
          cancel_url: CANCEL,
          consent_url: consentUrl ?? "",
        },
      }));
    case "booking_paid":
      return [
        { paid: 45, owed: 0, consent: null },
        { paid: 20, owed: 25, consent: CONSENT },
      ].map(({ paid, owed, consent }) => ({
        label: owed ? "deposit" : "paid in full",
        legacy: bookingConfirmationEmail({
          name: s.name,
          serviceName: s.service,
          date: s.date,
          time: s.time,
          duration: s.duration,
          dateIso: DATE_ISO,
          locale,
          paidEur: paid,
          owedEur: owed,
          consentUrl: consent,
        }),
        fixed: {
          ...base,
          sessionType: null,
          dateIso: DATE_ISO,
          paidEur: paid,
          owedEur: owed,
          consentUrl: consent,
        },
        values: {
          first_name: s.name,
          service: s.service,
          date: s.date,
          time: s.time,
          duration: s.duration,
          amount_paid: String(paid),
          amount_due: String(owed),
          consent_url: consent ?? "",
        },
      }));
    case "booking_rescheduled":
      return [
        {
          label: "default",
          legacy: bookingRescheduledEmail({
            name: s.name,
            service: s.service,
            sessionType: s.sessionType,
            date: s.date,
            time: s.time,
            duration: s.duration,
            dateIso: DATE_ISO,
            cancelUrl: CANCEL,
            locale,
          }),
          fixed: { ...base, dateIso: DATE_ISO, cancelUrl: CANCEL },
          values: { ...common, cancel_url: CANCEL },
        },
      ];
    case "booking_cancelled":
      return [
        {
          label: "default",
          legacy: bookingCancelledEmail({
            name: s.name,
            service: s.service,
            sessionType: s.sessionType,
            date: s.date,
            time: s.time,
            duration: s.duration,
            locale,
          }),
          fixed: base,
          values: common,
        },
      ];
    case "booking_reminder":
      return [
        {
          label: "default",
          legacy: bookingReminderEmail({
            name: s.name,
            service: s.service,
            sessionType: s.sessionType,
            date: s.date,
            time: s.time,
            duration: s.duration,
            dateIso: DATE_ISO,
            cancelUrl: CANCEL,
            locale,
          }),
          fixed: { ...base, dateIso: DATE_ISO, cancelUrl: CANCEL },
          values: { ...common, cancel_url: CANCEL },
        },
      ];
    case "consent_request":
      return [
        {
          label: "default",
          legacy: consentRequestEmail({ name: s.name, url: CONSENT, locale }),
          fixed: { ...base, consentUrl: CONSENT },
          values: { first_name: s.name, consent_url: CONSENT },
        },
      ];
    case "bonus_purchase": {
      const amount = locale === "es" ? "180,00 €" : "€180.00";
      const expiresOn =
        locale === "es" ? "20 de agosto de 2027" : "20 August 2027";
      return [
        {
          label: "default",
          legacy: bonusPurchaseEmail({
            name: s.name,
            service: s.sessionType,
            sessions: 5,
            amount,
            expiresOn,
            locale,
          }),
          fixed: {
            ...base,
            service: s.sessionType,
            bonus: { sessions: 5, amount, expiresOn },
          },
          values: {
            first_name: s.name,
            service: s.sessionType,
            sessions: "5",
            amount_paid: amount,
            expires_on: expiresOn,
          },
        },
      ];
    }
  }
}
