import { describe, expect, test } from "bun:test";
import {
  MESSAGE_CATALOG,
  MESSAGE_KEYS,
  type MessageKey,
} from "@/lib/messages/catalog";
import { fixedBlocks } from "@/lib/messages/fixed-blocks";
import type { CampaignLocale } from "@/types/campaign";
import { emailBase } from "../templates/_base";
import {
  casesFor,
  docParagraphs,
  fill,
  squash,
  visibleText,
} from "./legacy-cases";
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
