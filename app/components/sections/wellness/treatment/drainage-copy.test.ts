import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import en from "../../../../../messages/en/wellness.json";
import es from "../../../../../messages/es/wellness.json";

/**
 * "About this treatment" on the page of the lymphatic drainage. The Spanish is
 * the text the centre approved (corrections of 20 November 2026, point 06) and
 * is pinned word for word, so it is not reworded by accident; the English is
 * its translation, paragraph for paragraph. The last line is a closing the
 * page sets apart in bold.
 */

type Detail = { body?: string; closing?: string };
const details = (messages: typeof es) =>
  messages.treatments.serviceDetail as unknown as Record<string, Detail>;
const paragraphs = (body: string | undefined) => (body ?? "").split(/\n{2,}/);

const APPROVED = [
  "El Drenaje Linfático Integrativo — Método Essentia es el fruto de años de estudio, experiencia y evolución profesional en el ámbito del drenaje linfático y las terapias manuales.",
  "Con el drenaje linfático como base fundamental, nuestro método integra diferentes técnicas manuales, trabajo abdominal, respiración consciente y diafragmática, incorporando ejercicios hipopresivos cuando las necesidades de la persona así lo requieren.",
  "Desde una visión integrativa, nuestro método tiene en cuenta la estrecha relación entre el sistema linfático, la respiración y el sistema nervioso autónomo, ampliando el enfoque del drenaje linfático tradicional hacia una comprensión más global del cuerpo.",
  "Nuestro método parte de la comprensión individual del cuerpo. Desde el primer encuentro, realizamos una valoración que nos permite definir un tratamiento coherente con las necesidades, el contexto y el momento vital de cada persona.",
  "Como parte de nuestro método, podemos complementar la sesión con fotobiomodulación mediante luz roja e infrarroja, según las necesidades individuales.",
];
const APPROVED_CLOSING =
  "El drenaje linfático es nuestro origen. La integración de técnicas es nuestra evolución.";

describe("the drainage's 'about this treatment'", () => {
  const esDrainage = details(es)["drenaje-linfatico"]!;
  const enDrainage = details(en)["drenaje-linfatico"]!;

  test("the Spanish is the approved text, paragraph by paragraph", () => {
    expect(paragraphs(esDrainage.body)).toEqual(APPROVED);
  });

  test("and its last line is the closing, apart from the paragraphs", () => {
    expect(esDrainage.closing).toBe(APPROVED_CLOSING);
    expect(esDrainage.body).not.toContain(APPROVED_CLOSING);
  });

  test("the English follows it paragraph for paragraph, with its own closing", () => {
    expect(paragraphs(enDrainage.body)).toHaveLength(APPROVED.length);
    expect(paragraphs(enDrainage.body)[0]).toStartWith(
      "Integrative Lymphatic Drainage — Essentia Method is the fruit of",
    );
    expect(enDrainage.closing).toBe(
      "Lymphatic drainage is our origin. The integration of techniques is our evolution.",
    );
    expect(enDrainage.body).not.toContain(enDrainage.closing!);
  });

  test("nothing of the text it replaces is left in either language", () => {
    for (const drainage of [esDrainage, enDrainage]) {
      expect(drainage.body).not.toMatch(
        /la estética empieza en la salud|aesthetics begin with health|Avanzado|Advanced/,
      );
    }
  });
});

describe("a closing line is set in bold by the page, for any treatment that has one", () => {
  const VIEW = readFileSync(
    join(import.meta.dir, "service-detail-view.tsx"),
    "utf8",
  );

  test("the page prints it inside <strong>, after the paragraphs, only when there is one", () => {
    expect(VIEW).toContain("t.has(`${service.id}.closing`)");
    expect(VIEW).toMatch(
      /<strong[^>]*>\s*\{t\(`\$\{service\.id\}\.closing`\)\}\s*<\/strong>/,
    );
    expect(VIEW.indexOf(".closing`)")).toBeGreaterThan(
      VIEW.indexOf(".split(/\\n{2,}/)"),
    );
  });

  test("Spanish and English give a closing to the same treatments", () => {
    const withClosing = (messages: typeof es) =>
      Object.entries(details(messages))
        .filter(([, detail]) => typeof detail === "object" && detail.closing)
        .map(([id]) => id)
        .sort();
    expect(withClosing(es)).toEqual(withClosing(en));
    expect(withClosing(es)).toEqual(["drenaje-linfatico"]);
  });
});
