import { describe, expect, test } from "bun:test";
import { optOutButtonKind } from "./optout-button";

describe("optOutButtonKind", () => {
  test("the exact words unsubscribe, however they are written", () => {
    for (const text of ["BAJA", "baja", "STOP", "Stop.", " ¡Baja! "]) {
      expect(optOutButtonKind(text)).toBe("optOut");
    }
  });
  test("a text about leaving that is not the exact word warns", () => {
    for (const text of [
      "Darme de baja",
      "Dar de baja",
      "Stop promotions",
      "Unsubscribe",
      "Quiero BAJA ya",
      "No más: STOP aquí",
    ]) {
      expect(optOutButtonKind(text)).toBe("looksLikeOptOut");
    }
  });
  test("a button about something else is plain", () => {
    // «Detener promociones» names none of the words the warning looks for.
    for (const text of [
      "Confirmar",
      "Reservar",
      "Ver mi cita",
      "",
      "Cancelar",
      "Detener promociones",
    ]) {
      expect(optOutButtonKind(text)).toBe("plain");
    }
  });
  test("accents and case are ignored when looking for the words", () => {
    expect(optOutButtonKind("DARME DE BAJA")).toBe("looksLikeOptOut");
    expect(optOutButtonKind("Bájame de la lista")).toBe("looksLikeOptOut");
  });
});

describe("where the rule lives", () => {
  test("the exact-word rule is in a file with no imports, which optout.ts re-exports unchanged", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const words = readFileSync(
      join(import.meta.dir, "optout-words.ts"),
      "utf8",
    );
    expect(words).not.toMatch(/^import /m);
    const optout = await import("./optout");
    const pure = await import("./optout-words");
    expect(optout.isOptOutText).toBe(pure.isOptOutText);
    // And the form reads the pure file, so the Meta client stays out of the browser.
    const button = readFileSync(
      join(import.meta.dir, "optout-button.ts"),
      "utf8",
    );
    expect(button).toContain('from "./optout-words"');
    expect(button).not.toContain('from "./optout"');
  });
});
