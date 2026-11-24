import { describe, expect, test } from "bun:test";
import { MESSAGE_KEYS } from "@/lib/messages/catalog";
import { fixedBlocksByKind } from "@/lib/messages/fixed-blocks";
import { casesFor, squash, visibleText } from "../defaults/legacy-cases";
import { bookingConfirmationEmail } from "./booking-confirmation";
import { bookingConfirmedEmail } from "./booking-confirmed";

/**
 * The booking emails say the policy of 2026-11-24 as the Terms do: change or
 * cancel up to 24 hours before the session, the money back when it is
 * cancelled, no refund within the last 24 hours or for a no-show. Nothing
 * offers a deposit or keeps the money as credit. A booking made with a deposit
 * before that day still gets its balance line in the paid confirmation.
 */

const CLOSE = {
  es: "Para cambiar o cancelar tu cita, escríbenos hasta 24 horas antes de la sesión; si la cancelas, te devolvemos el importe pagado. Dentro de las 24 horas previas, o si no acudes, no hay reembolso.",
  en: "To change or cancel your appointment, write to us up to 24 hours before the session; if you cancel, we refund what you paid. Within the last 24 hours, or if you do not turn up, there is no refund.",
} as const;
const CANCEL_LINE = {
  es: "¿No puedes venir? Cancela o cambia tu cita hasta 24 horas antes; si la cancelas, te devolvemos lo que hayas pagado.",
  en: "Cannot make it? Cancel or change your appointment up to 24 hours before; if you cancel, we refund what you paid.",
} as const;

const SESSION = {
  name: "Ana",
  date: "jueves, 20 de agosto de 2026",
  time: "10:30",
  duration: "60 min",
  dateIso: "2026-08-20",
};
const text = (html: string) => squash(visibleText(html));

describe("the paid confirmation", () => {
  for (const locale of ["es", "en"] as const) {
    test(`${locale}: paid in full, it states the rule and owes nothing`, () => {
      const out = text(
        bookingConfirmationEmail({
          ...SESSION,
          serviceName: "Drenaje",
          locale,
          paidEur: 130,
          owedEur: 0,
        }),
      );
      expect(out).toContain(CLOSE[locale]);
      expect(out).not.toMatch(
        /Pendiente de pago|Due at the centre|El resto se abona|The balance is paid/,
      );
    });
  }

  test("a booking made with a deposit before 2026-11-24 still shows its balance", () => {
    const es = text(
      bookingConfirmationEmail({
        ...SESSION,
        serviceName: "Drenaje",
        locale: "es",
        paidEur: 65,
        owedEur: 65,
      }),
    );
    expect(es).toContain("Pendiente de pago en el centro");
    expect(es).toContain("El resto se abona el día de la sesión.");
    expect(es).toContain(CLOSE.es);
  });
});

describe("the staff confirmation", () => {
  for (const locale of ["es", "en"] as const) {
    test(`${locale}: the cancellation line and the closing say the refund`, () => {
      const out = text(
        bookingConfirmedEmail({
          ...SESSION,
          service: "Drenaje",
          locale,
          cancelUrl: "https://example.test/cancel?token=abc",
        }),
      );
      expect(out).toContain(CANCEL_LINE[locale]);
      expect(out).toContain(CLOSE[locale]);
    });
  }

  test("the cancellation block of an edited message says the same", () => {
    for (const locale of ["es", "en"] as const) {
      const blocks = fixedBlocksByKind(
        "booking_confirmed",
        casesFor("booking_confirmed", locale)[0]!.fixed,
      );
      expect(text(blocks.cancel_link ?? "")).toBe(
        `${CANCEL_LINE[locale]} ${locale === "es" ? "Cancelar mi cita" : "Cancel my appointment"}`,
      );
    }
  });
});

describe("no booking email", () => {
  test("offers a deposit, a cancellation 'at no cost' or credit instead of the money", () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of ["es", "en"] as const) {
        for (const c of casesFor(key, locale)) {
          const out = text(c.legacy);
          expect(`${key}/${locale}: ${out}`).not.toMatch(
            /dep[oó]sit|señal|sin coste|at no cost|saldo a (tu|su) favor|as a credit/i,
          );
        }
      }
    }
  });
});
