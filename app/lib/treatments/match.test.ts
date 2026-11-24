import { describe, expect, it } from "bun:test";
import {
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";
import { sameTreatment, treatmentForTier, withoutTierLabels } from "./match";

const OLD = "Drenaje Linfático Avanzado";
const NEW = "Drenaje Linfático Integrativo — Método Essentia";

describe("sameTreatment", () => {
  it("matches a label to a title ignoring case and spaces", () => {
    expect(sameTreatment(" essentia   active ", "Essentia Active")).toBe(true);
  });

  it("does not match different titles", () => {
    expect(sameTreatment("Essentia Active", NEW)).toBe(false);
    expect(sameTreatment("Essentia Signature", "Essentia IV Signature")).toBe(
      false,
    );
  });

  it("never matches an empty or missing side", () => {
    expect(sameTreatment(null, "x")).toBe(false);
    expect(sameTreatment("x", undefined)).toBe(false);
    expect(sameTreatment("", "")).toBe(false);
  });

  it("two names nobody declared are the same only when they read the same", () => {
    expect(sameTreatment("Masaje nuevo", "masaje nuevo")).toBe(true);
    expect(sameTreatment("Masaje nuevo", "Masaje viejo")).toBe(false);
  });
});

describe("a treatment whose name changed: its session type meets it under either name", () => {
  // The lymphatic drainage was renamed on the site. Its session type keeps the
  // old label in the database until the centre changes it there, and the day
  // it does must not be the day the price, the booking link and the bonuses of
  // that treatment stop finding it.
  it("the label the database has today is still this treatment", () => {
    expect(sameTreatment(OLD, NEW)).toBe(true);
    expect(sameTreatment(` ${OLD.toLowerCase()} `, NEW)).toBe(true);
  });

  it("and so is the new name, once the database says it", () => {
    expect(sameTreatment(NEW, NEW)).toBe(true);
    expect(sameTreatment("drenaje linfático integrativo", NEW)).toBe(true);
  });

  it("however the dash between the two halves is typed", () => {
    for (const label of [
      "Drenaje Linfático Integrativo - Método Essentia",
      "Drenaje Linfático Integrativo – Método Essentia",
      "Drenaje Linfático Integrativo · Método Essentia",
      "Drenaje Linfático Integrativo—Método Essentia",
    ]) {
      expect(sameTreatment(label, NEW)).toBe(true);
    }
  });

  it("the two names are each other's too, whichever side holds which", () => {
    expect(sameTreatment(NEW, OLD)).toBe(true);
  });

  it("it is still not any other treatment", () => {
    expect(sameTreatment(OLD, "Essentia Active")).toBe(false);
    expect(sameTreatment("Drenaje", NEW)).toBe(false);
    expect(sameTreatment("Drenaje Linfático", NEW)).toBe(false);
  });
});

describe("treatmentForTier", () => {
  it("finds the treatment a tier label belongs to", () => {
    expect(
      treatmentForTier(manualTherapyTreatments, "Essentia Active")?.id,
    ).toBe("essentia-active");
  });

  it("finds the renamed one under the old label and under the new", () => {
    for (const label of [OLD, NEW, "  drenaje linfático avanzado "]) {
      expect(treatmentForTier(manualTherapyTreatments, label)?.id).toBe(
        "drenaje-linfatico",
      );
    }
  });

  it("returns null when no treatment carries that label", () => {
    expect(
      treatmentForTier(manualTherapyTreatments, "Algo que no existe"),
    ).toBeNull();
    expect(treatmentForTier(manualTherapyTreatments, null)).toBeNull();
  });
});

describe("the names the treatments answer to", () => {
  const all = [
    ...manualTherapyTreatments,
    ...facialTreatments,
    ...ivProtocols,
  ] as { id: string; title: string; tierLabels?: string[] }[];

  it("no name, old or new, belongs to two treatments", () => {
    for (const a of all) {
      for (const b of all) {
        if (a === b) continue;
        for (const name of [a.title, ...(a.tierLabels ?? [])]) {
          expect(`${name} is ${b.title}: ${sameTreatment(name, b.title)}`).toBe(
            `${name} is ${b.title}: false`,
          );
        }
      }
    }
  });

  it("the drainage shows its new name and still answers to the old one", () => {
    const drainage = manualTherapyTreatments.find(
      (t) => t.id === "drenaje-linfatico",
    );
    expect(drainage?.title).toBe(NEW);
    expect(drainage?.tierLabels).toContain(OLD);
  });
});

describe("withoutTierLabels: what a page is handed", () => {
  it("everything of the treatment but the labels its session type has carried", () => {
    const drainage = manualTherapyTreatments.find(
      (t) => t.id === "drenaje-linfatico",
    )!;
    const shown = withoutTierLabels(drainage);
    expect("tierLabels" in shown).toBe(false);
    expect(JSON.stringify(shown)).not.toContain(OLD);
    expect(shown).toMatchObject({ id: drainage.id, title: NEW });
    // The treatment itself is not touched: the server still finds it by them.
    expect(drainage.tierLabels).toContain(OLD);
  });

  it("a treatment that never had any is handed as it is", () => {
    const espira = manualTherapyTreatments.find((t) => t.id === "espira")!;
    expect(withoutTierLabels(espira)).toEqual(espira);
  });
});
