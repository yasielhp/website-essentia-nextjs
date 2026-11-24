import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import enFaqs from "../../../../../messages/en/serviceFaqs.json";
import esFaqs from "../../../../../messages/es/serviceFaqs.json";
import { serviceFaqs } from "@/data/service-faqs";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/llms";
import { PrivacyEN } from "./privacy/content-en";
import { PrivacyES } from "./privacy/content-es";
import { TermsEN } from "./terms/content-en";
import { TermsES } from "./terms/content-es";

/**
 * The payment policy, as the owner set it on 2026-11-24, said the same way
 * everywhere a client reads it: the whole price is paid online when booking;
 * a booking can be changed or cancelled up to 24 hours before the session, and
 * the money is refunded when it is cancelled at least 24 hours ahead; within
 * the last 24 hours, or a no-show, there is no refund. No deposit, and no
 * credit kept for a new appointment instead of the refund.
 */

/** The visible text of a page, one space between words. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

const termsEs = text(renderToStaticMarkup(<TermsES />));
const termsEn = text(renderToStaticMarkup(<TermsEN />));
const privacyEs = text(renderToStaticMarkup(<PrivacyES />));
const privacyEn = text(renderToStaticMarkup(<PrivacyEN />));

const NO_DEPOSIT = /señal|dep[oó]sit|saldo a su favor|as a credit/i;

describe("the Terms", () => {
  test("ask for the whole price when booking online, and no deposit", () => {
    expect(termsEs).toContain(
      "requieren el pago del importe íntegro de la sesión en el momento de reservar",
    );
    expect(termsEn).toContain(
      "require payment of the full price of the session at the time of booking",
    );
    expect(termsEs).not.toMatch(NO_DEPOSIT);
    expect(termsEn).not.toMatch(NO_DEPOSIT);
  });

  test("refund a cancellation made at least 24 hours ahead, and nothing within them", () => {
    expect(termsEs).toContain(
      "sin cargo hasta 24 horas antes de la hora programada",
    );
    expect(termsEs).toContain(
      "Si la reserva se cancela con al menos 24 horas de antelación, se le reembolsará íntegramente el importe abonado por adelantado",
    );
    expect(termsEs).toContain(
      "Las cancelaciones en las 24 horas previas o la no presentación no darán derecho al reembolso",
    );
    expect(termsEn).toContain(
      "at no charge up to 24 hours before the scheduled time",
    );
    expect(termsEn).toContain(
      "If a booking is cancelled at least 24 hours in advance, any amount paid in advance will be refunded in full",
    );
    expect(termsEn).toContain(
      "Cancellations within 24 hours or no-shows are not entitled to a refund",
    );
  });

  test("keep the consumer-law reservation", () => {
    expect(termsEs).toContain(
      "sin perjuicio de los derechos que le reconozca la legislación de consumo",
    );
    expect(termsEn).toContain(
      "without prejudice to your rights under consumer law",
    );
  });
});

describe("the Privacy Policy", () => {
  test("names no deposit among the booking data", () => {
    expect(privacyEs).not.toMatch(NO_DEPOSIT);
    expect(privacyEn).not.toMatch(NO_DEPOSIT);
  });
});

describe("the treatment FAQs", () => {
  const families = ["manual-therapies", "facial-therapies"] as const;
  const answers = (
    faqs: typeof esFaqs | typeof enFaqs,
    family: (typeof families)[number],
  ) => Object.values(faqs[family]).map((f) => f.answer);

  test("in both languages, offer no payment at the centre to a booking made online", () => {
    for (const faqs of [esFaqs, enFaqs]) {
      for (const family of families) {
        for (const answer of answers(faqs, family)) {
          expect(answer).not.toMatch(
            /pagar en el centro el día|pay at the centre on the day/i,
          );
          expect(answer).not.toMatch(NO_DEPOSIT);
        }
      }
    }
  });

  test("in both languages, say up to 24 hours before, the refund, and none within them", () => {
    for (const family of families) {
      const esMiss = answers(esFaqs, family).find((a) =>
        a.includes("hasta 24 horas antes"),
      );
      const enMiss = answers(enFaqs, family).find((a) =>
        a.includes("up to 24 hours before"),
      );
      expect(esMiss).toContain("te devolvemos el importe pagado");
      expect(esMiss).toContain("no hay reembolso");
      expect(enMiss).toContain("we refund what you paid");
      expect(enMiss).toContain("there is no refund");
    }
  });

  test("the English data behind the FAQ schema says what the page says", () => {
    for (const family of families) {
      expect(serviceFaqs[family]!.map((f) => f.answer)).toEqual(
        answers(enFaqs, family),
      );
    }
  });
});

describe("the files for assistants", () => {
  test("say the full price is paid online and the 24-hour rule with the refund", () => {
    for (const file of [buildLlmsTxt(), buildLlmsFullTxt()]) {
      expect(file).toContain("The full price is paid online when booking.");
      expect(file).toContain("up to 24 hours before the session");
      expect(file).toContain("at least 24 hours ahead is refunded");
      expect(file).not.toMatch(NO_DEPOSIT);
    }
  });
});
