import { describe, expect, it } from "bun:test";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import { fixedBlocksByKind } from "./fixed-blocks";
import { legacySampleEmail, sampleFixed, sampleVars } from "./samples";

const LOCALES = ["en", "es"] as const;

describe("sampleVars", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      it(`${key}/${locale}: has a non-empty value for every variable it offers, and no other`, () => {
        const vars = sampleVars(key, locale);
        const offered = [...MESSAGE_CATALOG[key].variables].sort();
        expect(Object.keys(vars).sort()).toEqual(offered);
        for (const name of offered) {
          expect((vars as Record<string, string>)[name]?.trim() ?? "").not.toBe(
            "",
          );
        }
      });
    }
  }

  it("makes every link an obvious example address, never a real one", () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of LOCALES) {
        const vars = sampleVars(key, locale);
        for (const name of ["cancel_url", "consent_url"] as const) {
          const url = vars[name];
          if (url) expect(url.startsWith("https://example.com/")).toBe(true);
        }
      }
    }
  });

  it("prints the date the way each message does today", () => {
    expect(sampleVars("booking_confirmed", "es").date).toBe(
      "jueves, 20 de agosto de 2026",
    );
    expect(sampleVars("booking_confirmed", "en").date).toBe(
      "Thursday, 20 August 2026",
    );
    // The paid confirmation prints no weekday.
    expect(sampleVars("booking_paid", "es").date).toBe("20 de agosto de 2026");
    expect(sampleVars("booking_paid", "en").date).toBe("20 August 2026");
  });

  it("prints amounts with the currency on the language's side", () => {
    expect(sampleVars("booking_paid", "es").amount_paid).toBe("20,00\u00a0€");
    expect(sampleVars("booking_paid", "en").amount_paid).toBe("€20.00");
    expect(sampleVars("booking_received", "es").amount_due).toBe("45 €");
    expect(sampleVars("booking_received", "en").amount_due).toBe("€45");
  });
});

describe("sampleFixed and legacySampleEmail", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      it(`${key}/${locale}: the fixed blocks and the legacy email are built from the same sample`, () => {
        const vars = sampleVars(key, locale);
        const fixed = sampleFixed(key, locale);
        expect(fixed.locale).toBe(locale);
        expect(
          Object.values(fixedBlocksByKind(key, fixed)).join("").length,
        ).toBeGreaterThan(0);
        const legacy = legacySampleEmail(key, locale);
        expect(legacy).toContain("<html");
        if (vars.service && key !== "bonus_purchase") {
          expect(legacy).toContain(vars.service);
        }
        expect(legacy).toContain("Ana");
      });
    }
  }

  it("shows the optional blocks so the test email exercises them", () => {
    expect(sampleFixed("booking_confirmed", "es").consentUrl).toContain(
      "https://example.com/",
    );
    expect(sampleFixed("booking_received", "es").amountDueEur).toBe(45);
    expect(sampleFixed("booking_paid", "es").owedEur).toBeGreaterThan(0);
  });
});
