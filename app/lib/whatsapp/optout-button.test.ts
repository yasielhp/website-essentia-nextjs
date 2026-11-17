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
