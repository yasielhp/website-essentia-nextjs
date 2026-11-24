import { describe, expect, test } from "bun:test";
import { toTierSnapshot } from "@/lib/treatments/prices";
import {
  hiddenTreatmentIds,
  isTreatmentFamily,
  TREATMENTS_OF,
} from "@/lib/treatments/visibility";

/**
 * Which treatments the public site hides: those whose session type the centre
 * switched off in Settings (the owner's rule of 2026-11-24). The rows are the
 * database's as `service_tiers` holds them; the treatments are the site's own.
 */

const row = (label: string, active: unknown) => ({
  label,
  duration_minutes: 60,
  price_eur: 90,
  price_center_eur: 90,
  active,
});

const hidden = (
  family: keyof typeof TREATMENTS_OF,
  rows: ReturnType<typeof row>[],
) => hiddenTreatmentIds(TREATMENTS_OF[family], toTierSnapshot(rows));

describe("hiddenTreatmentIds", () => {
  test("the session types switched off on 2026-11-24 hide their three treatments, and only them", () => {
    expect(
      hidden("manual-therapies", [
        row("Espira", true),
        row("Drenaje Linfático Avanzado", true),
        row("Alure Duo", false),
        row("Essentia Signature", false),
      ]),
    ).toEqual(["alure-duo", "essentia-signature"]);
    expect(
      hidden("facial-therapies", [
        row("Anesis", true),
        row("Aurum", true),
        row("Eleva", true),
        row("Kinéa Signature", false),
      ]),
    ).toEqual(["kinea-signature"]);
  });

  test("switched back on, the treatment is back: nothing in code says which", () => {
    expect(
      hidden("manual-therapies", [
        row("Alure Duo", true),
        row("Essentia Signature", true),
      ]),
    ).toEqual([]);
  });

  test("a treatment with a session type still on sale stays, even with another switched off", () => {
    // The lymphatic drainage answers to its old label too: one of its names
    // switched off and another on sale is a treatment on sale.
    expect(
      hidden("manual-therapies", [
        row("Drenaje Linfático Integrativo", false),
        row("Drenaje Linfático Avanzado", true),
      ]),
    ).toEqual([]);
  });

  test("a treatment with no session type at all is not hidden: a name nobody matched is no decision", () => {
    expect(hidden("manual-therapies", [])).toEqual([]);
    expect(hidden("manual-therapies", [row("Somebody else", false)])).toEqual(
      [],
    );
  });

  test("the name is matched as the prices match it: case, spaces and dashes aside", () => {
    expect(hidden("manual-therapies", [row("  alure   duo ", false)])).toEqual([
      "alure-duo",
    ]);
  });

  test("only a row that says it is switched off hides; an odd answer hides nothing", () => {
    for (const active of [null, undefined, "false", 0]) {
      expect(hidden("manual-therapies", [row("Alure Duo", active)])).toEqual(
        [],
      );
    }
  });

  test("an IV protocol is hidden the same way", () => {
    expect(
      hidden("intravenous-therapy", [
        row("NAD+", false),
        row("Power Drip", true),
      ]),
    ).toEqual(["nad-plus"]);
  });
});

describe("toTierSnapshot", () => {
  test("prices the ones on sale, and names the ones on sale and switched off", () => {
    expect(
      toTierSnapshot([row("Espira", true), row("Alure Duo", false)]),
    ).toEqual({
      prices: [{ label: "Espira", durationMinutes: 60, priceEur: 90 }],
      onSale: ["Espira"],
      switchedOff: ["Alure Duo"],
    });
  });

  test("an answer that is not a list, or rows with no name, are nothing", () => {
    const nothing = { prices: [], onSale: [], switchedOff: [] };
    expect(toTierSnapshot(null)).toEqual(nothing);
    expect(toTierSnapshot({ label: "Espira" })).toEqual(nothing);
    expect(toTierSnapshot([null, 3, row("", false), row("   ", true)])).toEqual(
      nothing,
    );
  });
});

describe("isTreatmentFamily", () => {
  test("the three services with a page per treatment, and nothing else", () => {
    expect(isTreatmentFamily("manual-therapies")).toBe(true);
    expect(isTreatmentFamily("facial-therapies")).toBe(true);
    expect(isTreatmentFamily("intravenous-therapy")).toBe(true);
    for (const value of ["", "nope", "manual-therapies ", 42, null]) {
      expect(isTreatmentFamily(value)).toBe(false);
    }
  });
});
