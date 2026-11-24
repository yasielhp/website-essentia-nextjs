import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import enBooking from "../../../../../messages/en/booking.json";
import esBooking from "../../../../../messages/es/booking.json";
import { TermsEN } from "./terms/content-en";
import { TermsES } from "./terms/content-es";

/**
 * The bonus rule, as the owner set it on 2026-11-24, said the same way where a
 * client reads it: a session cancelled at least 24 hours before goes back to
 * the bonus; one cancelled within the last 24 hours, or a no-show, is lost.
 */

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/\s+/g, " ");

const termsEs = text(renderToStaticMarkup(<TermsES />));
const termsEn = text(renderToStaticMarkup(<TermsEN />));

describe("Terms 3.4, the session vouchers", () => {
  test("a session cancelled at least 24 hours ahead goes back to the bonus", () => {
    expect(termsEs).toContain(
      "Si la reserva se cancela con al menos 24 horas de antelación, la sesión se devuelve al bono",
    );
    expect(termsEn).toContain(
      "If the booking is cancelled at least 24 hours in advance, the session goes back to the voucher",
    );
  });

  test("one cancelled within the last 24 hours, or not attended, is lost", () => {
    expect(termsEs).toContain(
      "una sesión cancelada en las 24 horas previas o a la que no se asista se pierde y se considera consumida",
    );
    expect(termsEn).toContain(
      "a session cancelled within the 24 hours before it, or not attended, is lost and counts as used",
    );
  });
});

describe("the cancel page, for a bonus session", () => {
  test("says the session goes back to the bonus, and that inside the 24 hours it is taken", () => {
    expect(esBooking.cancel.confirm.bodyBonus).toContain("vuelve a tu bono");
    expect(esBooking.cancel.done.bodyBonus).toContain("vuelve a tu bono");
    expect(esBooking.cancel.late.bodyBonus).toContain(
      "la sesión se descuenta de tu bono",
    );
    expect(enBooking.cancel.confirm.bodyBonus).toContain(
      "goes back to your voucher",
    );
    expect(enBooking.cancel.done.bodyBonus).toContain(
      "goes back to your voucher",
    );
    expect(enBooking.cancel.late.bodyBonus).toContain(
      "the session is taken from your voucher",
    );
  });

  test("never promises money back for a bonus session", () => {
    for (const body of [
      esBooking.cancel.confirm.bodyBonus,
      esBooking.cancel.done.bodyBonus,
      enBooking.cancel.confirm.bodyBonus,
      enBooking.cancel.done.bodyBonus,
    ]) {
      expect(body).not.toMatch(/devol(vemos|veremos) (el|los)|refund/i);
    }
  });
});
