import { describe, expect, test } from "bun:test";
import {
  MESSAGE_CATALOG,
  MESSAGE_KEYS,
  type MessageKey,
} from "@/lib/messages/catalog";
import { composeMessageEmail } from "@/lib/messages/compose";
import {
  fixedBlocks,
  fixedBlocksHtml,
  fixedBlocksSplit,
} from "@/lib/messages/fixed-blocks";
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

// ── order ──────────────────────────────────────────────────────────────────

/**
 * The visible phrases of a message, in the order they must appear: the
 * preheader, the kicker line, the title, the rest of the intro, the fixed
 * blocks the legacy email prints before its closing sentence, the closing
 * sentence, and whatever the legacy email prints after it.
 *
 * The one place the custom email differs from the legacy one is the kicker:
 * the legacy email prints it above the title, the custom one has it as the
 * first line of the body, under the title. `kickerFirst` picks which.
 */
function expectedSequence(
  key: MessageKey,
  locale: CampaignLocale,
  c: ReturnType<typeof casesFor>[number],
  kickerFirst: boolean,
): string[] {
  const def = defaultContent(key, locale);
  const intro = docParagraphs(def.intro).map((p) => fill(p, c.values));
  const hasKicker = key !== "consent_request";
  const kicker = hasKicker ? [intro[0]!] : [];
  const rest = hasKicker ? intro.slice(1) : intro;
  const title = fill(def.title, c.values);
  const { before, after } = fixedBlocksSplit(key, c.fixed);
  return [
    ...(def.preheader ? [fill(def.preheader, c.values)] : []),
    ...(kickerFirst ? [...kicker, title] : [title, ...kicker]),
    ...rest,
    ...before.map(visibleText),
    ...docParagraphs(def.outro).map((p) => fill(p, c.values)),
    ...after.map(visibleText),
  ];
}

/** Every phrase appears, each after the one before it. */
function expectInOrder(text: string, phrases: string[]) {
  let from = 0;
  for (const phrase of phrases) {
    const at = text.indexOf(phrase, from);
    expect({ phrase, found: at >= 0 }).toEqual({ phrase, found: true });
    from = at + phrase.length;
  }
}

describe("intro, fixed blocks and closing sentence are in the legacy order", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      for (const c of casesFor(key, locale)) {
        test(`${key}/${locale} (${c.label}): the legacy email prints them in this sequence`, () => {
          expectInOrder(
            visibleText(c.legacy),
            expectedSequence(key, locale, c, true),
          );
        });
      }
    }
  }

  test("only messages with a closing sentence have an outro", () => {
    const withOutro = MESSAGE_KEYS.filter(
      (key) => defaultContent(key, "es").outro !== null,
    );
    expect(withOutro.sort()).toEqual([
      "bonus_purchase",
      "booking_cancelled",
      "booking_confirmed",
      "booking_paid",
      "booking_received",
      "booking_rescheduled",
    ]);
  });

  test("the editor's document is the intro and the closing together", () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of LOCALES) {
        const def = defaultContent(key, locale);
        expect(docParagraphs(def.doc)).toEqual([
          ...docParagraphs(def.intro),
          ...docParagraphs(def.outro),
        ]);
      }
    }
  });
});

describe("a saved row with no body of its own sends the default body in the legacy order", () => {
  // The admin only changed the subject: the body is still the default one.
  const subjectOnly = {
    subject: "Asunto del centro",
    preheader: null,
    title: null,
    doc: null,
    enabled: true,
  };

  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      for (const c of casesFor(key, locale)) {
        test(`${key}/${locale} (${c.label}): the custom email follows the same sequence`, async () => {
          const { html } = await composeMessageEmail({
            key,
            locale,
            row: subjectOnly,
            vars: c.values,
            fixedHtml: fixedBlocksHtml(key, c.fixed),
          });
          expect(html).not.toContain("<!--outro-->");
          expectInOrder(
            visibleText(html),
            expectedSequence(key, locale, c, false),
          );
        });
      }
    }
  }

  test("a body of the admin's own replaces the closing sentence too, and goes before the blocks", async () => {
    const [c] = casesFor("booking_confirmed", "es");
    const { html } = await composeMessageEmail({
      key: "booking_confirmed",
      locale: "es",
      row: {
        ...subjectOnly,
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Texto propio del centro." }],
            },
          ],
        },
      },
      vars: c!.values,
      fixedHtml: fixedBlocksHtml("booking_confirmed", c!.fixed),
    });
    const text = visibleText(html);
    expect(text).not.toContain("Si necesitas cancelar o cambiar la fecha");
    expectInOrder(text, ["Texto propio del centro.", "Detalles de la sesión"]);
  });
});
