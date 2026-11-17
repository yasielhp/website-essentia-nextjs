import { describe, expect, test } from "bun:test";
import {
  MESSAGE_CATALOG,
  MESSAGE_KEYS,
  type MessageKey,
} from "@/lib/messages/catalog";
import { fixedBlocks, type FixedBlocksData } from "@/lib/messages/fixed-blocks";
import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import { emailBase } from "../templates/_base";
import { bonusPurchaseEmail } from "../templates/bonus-purchase";
import { bookingCancelledEmail } from "../templates/booking-cancelled";
import { bookingConfirmationEmail } from "../templates/booking-confirmation";
import { bookingConfirmedEmail } from "../templates/booking-confirmed";
import { bookingReceivedEmail } from "../templates/booking-received";
import { bookingReminderEmail } from "../templates/booking-reminder";
import { bookingRescheduledEmail } from "../templates/booking-rescheduled";
import { consentRequestEmail } from "../templates/consent-request";
import { defaultContent } from "./index";

/**
 * The guardian: the default text the editor opens with must be the text the
 * legacy template really sends. It compares the visible words of the HTML each
 * legacy function produces with the defaults, in both directions:
 *
 *  - every phrase of a default (title, preheader, each paragraph) appears in
 *    what the legacy email shows, and
 *  - once the shell, the fixed blocks and the default phrases are taken out of
 *    what the legacy email shows, nothing but punctuation is left, so no
 *    sentence of the legacy email is missing from the default.
 */

const SAMPLE = {
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

function visibleText(html: string): string {
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

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

function docParagraphs(doc: EmailDoc | null): string[] {
  const textOf = (node: EmailDoc): string => {
    if (node.type === "hardBreak") return " ";
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map(textOf).join("");
  };
  return (doc?.content ?? []).map((node) => squash(textOf(node)));
}

function fill(text: string, values: Record<string, string>): string {
  return squash(
    text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, name: string) => {
      const value = values[name];
      if (value === undefined) throw new Error(`no sample for {{${name}}}`);
      return value;
    }),
  );
}

// ── one legacy case: the email, the data behind it, and the variables ──────

type Case = {
  label: string;
  legacy: string;
  fixed: FixedBlocksData;
  values: Record<string, string>;
};

function casesFor(key: MessageKey, locale: CampaignLocale): Case[] {
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

/**
 * Text the legacy email carries around its body, in the pieces it appears in:
 * the paid confirmation's header and footer are not next to each other.
 */
function shellPieces(key: MessageKey, locale: CampaignLocale): string[] {
  if (key === "booking_paid") {
    return [
      "ESSENTIA",
      "Essentia — Longevity Center & Social Wellness Club, Tenerife Rambla de Santa Cruz, 83, 38004 Santa Cruz de Tenerife",
    ];
  }
  return [visibleText(emailBase({ locale, preheader: "", body: "" }))];
}

// The one subject per message and language that lives in a caller, copied from
// there: `notify.ts` (`clientSubjects`), `booking-cancellation.ts`,
// `booking-payments.service.ts`, `bonus-payments.service.ts`, `consent.ts` and
// the reminder cron. Variables are written as the callers interpolate them.
const LEGACY_SUBJECTS: Record<
  MessageKey,
  Record<CampaignLocale, string | null>
> = {
  booking_received: {
    es: "Solicitud de reserva recibida — {{service}}",
    en: "Booking request received — {{service}}",
  },
  booking_confirmed: {
    es: "Tu reserva ha sido confirmada — {{service}}",
    en: "Booking confirmed — {{service}}",
  },
  booking_paid: {
    es: "Tu reserva en Essentia está confirmada",
    en: "Your Essentia booking is confirmed",
  },
  booking_rescheduled: {
    es: "Sesión reprogramada — {{service}}",
    en: "Booking rescheduled — {{service}}",
  },
  booking_cancelled: {
    es: "Reserva cancelada — {{service}}",
    en: "Booking cancelled — {{service}}",
  },
  booking_reminder: {
    es: "Tu sesión del {{date}} — {{service}}",
    // The cron sends Spanish only: there is no English subject in the code.
    en: null,
  },
  consent_request: {
    es: "Completa tu consentimiento informado · Essentia",
    en: "Complete your informed consent · Essentia",
  },
  bonus_purchase: {
    es: "Tu bono de {{sessions}} sesiones está confirmado",
    en: "Your {{sessions}}-session voucher is confirmed",
  },
};

const LOCALES: CampaignLocale[] = ["es", "en"];

describe("the default text is the legacy text", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      const def = defaultContent(key, locale);

      test(`${key}/${locale}: the subject is the one the caller sends`, () => {
        const legacy = LEGACY_SUBJECTS[key][locale];
        if (legacy === null) return;
        expect(def.subject).toBe(legacy);
      });

      for (const c of casesFor(key, locale)) {
        const legacyText = visibleText(c.legacy);
        const phrases = [def.title, def.preheader, ...docParagraphs(def.doc)]
          .filter((p) => p !== "")
          .map((p) => fill(p, c.values));

        test(`${key}/${locale} (${c.label}): every default phrase is in the legacy email`, () => {
          for (const phrase of phrases) {
            expect(legacyText).toContain(phrase);
          }
        });

        test(`${key}/${locale} (${c.label}): no legacy sentence is missing from the default`, () => {
          let rest = legacyText;
          const take = (chunk: string) => {
            rest = rest.split(squash(chunk)).join(" ");
          };
          for (const piece of shellPieces(key, locale)) take(piece);
          for (const block of fixedBlocks(key, c.fixed))
            take(visibleText(block));
          for (const phrase of phrases) take(phrase);
          // Punctuation and whitespace may be left over; words may not.
          expect(rest.replace(/[\s.,:;!¡¿?·—–-]+/g, "")).toBe("");
        });
      }
    }
  }
});

describe("the defaults themselves", () => {
  test("every message offers only variables its catalogue entry lists", () => {
    for (const key of MESSAGE_KEYS) {
      const offered = new Set<string>(MESSAGE_CATALOG[key].variables);
      for (const locale of LOCALES) {
        const def = defaultContent(key, locale);
        const text = [
          def.subject,
          def.preheader,
          def.title,
          ...docParagraphs(def.doc),
        ].join(" ");
        for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
          expect(offered.has(m[1]!)).toBe(true);
        }
      }
    }
  });

  test("the subject is never empty", () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of LOCALES) {
        expect(defaultContent(key, locale).subject.trim()).not.toBe("");
      }
    }
  });
});
