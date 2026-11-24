import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import enFaqs from "../../../messages/en/serviceFaqs.json";
import esFaqs from "../../../messages/es/serviceFaqs.json";
import enWellness from "../../../messages/en/wellness.json";
import esWellness from "../../../messages/es/wellness.json";
import { treatments } from "@/components/sections/wellness/treatment/data";
import { serviceFaqs } from "@/data/service-faqs";
import { shownFaqs } from "@/lib/treatments/faqs";

/**
 * While a treatment is hidden from the site (its session type switched off),
 * no question of its service names it, on the page or in its FAQPage schema,
 * and no step of "what a session looks like" does either. The wording without
 * it is written in both languages; nothing is deleted.
 */

type Messages = Record<string, unknown>;
/** A translator over a messages file, as `getTranslations` behaves. */
const translator = (messages: Messages) => {
  const get = (key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === "object"
            ? (node as Record<string, unknown>)[part]
            : undefined,
        messages,
      );
  const t = (key: string) => {
    const value = get(key);
    if (typeof value !== "string") throw new Error(`missing ${key}`);
    return value;
  };
  t.has = (key: string) => typeof get(key) === "string";
  return t;
};

const LANGUAGES = { es: esFaqs, en: enFaqs } as const;
/** The words that name each hidden treatment, in either language. */
const NAMES: Record<string, RegExp> = {
  "kinea-signature": /kin[ée]a/i,
  "alure-duo": /alure|pareja|for two/i,
  "essentia-signature": /essentia signature|premium/i,
};
const ALL_HIDDEN = ["kinea-signature", "alure-duo", "essentia-signature"];

describe("shownFaqs", () => {
  test("with nothing hidden, every question with its own answer, in the page's language", () => {
    for (const [language, messages] of Object.entries(LANGUAGES)) {
      const shown = shownFaqs(
        "facial-therapies",
        serviceFaqs["facial-therapies"]!,
        [],
        translator(messages),
      );
      expect(shown).toHaveLength(serviceFaqs["facial-therapies"]!.length);
      expect(
        `${language}: ${shown.some((f) => /kin[ée]a/i.test(f.answer))}`,
      ).toBe(`${language}: true`);
    }
  });

  test("with a treatment hidden, no answer names it, and no question is lost", () => {
    for (const [language, messages] of Object.entries(LANGUAGES)) {
      for (const slug of ["manual-therapies", "facial-therapies"]) {
        const entries = serviceFaqs[slug]!;
        const shown = shownFaqs(
          slug,
          entries,
          ALL_HIDDEN,
          translator(messages),
        );
        expect(shown).toHaveLength(entries.length);
        for (const { question, answer } of shown) {
          for (const [id, name] of Object.entries(NAMES)) {
            expect(
              `${language} ${slug} ${id}: ${name.test(question + answer)}`,
            ).toBe(`${language} ${slug} ${id}: false`);
          }
        }
      }
    }
  });

  test("an answer that names a treatment declares it, so it can be left out", () => {
    // Every answer that names one carries `mentions`; one that names none does
    // not, so a new mention without its variant fails here.
    for (const [language, messages] of Object.entries(LANGUAGES)) {
      for (const slug of ["manual-therapies", "facial-therapies"]) {
        serviceFaqs[slug]!.forEach((entry, i) => {
          const answer = (
            messages as unknown as Record<
              string,
              Record<string, { answer: string; answerWithout?: string }>
            >
          )[slug]![String(i)]!;
          const named = Object.entries(NAMES)
            .filter(([, name]) => name.test(answer.answer))
            .map(([id]) => id)
            .sort();
          expect(`${language} ${slug} ${i}: ${named.join(",")}`).toBe(
            `${language} ${slug} ${i}: ${[...(entry.mentions ?? [])].sort().join(",")}`,
          );
          expect(`${language} ${slug} ${i}: ${"answerWithout" in answer}`).toBe(
            `${language} ${slug} ${i}: ${Boolean(entry.mentions)}`,
          );
        });
      }
    }
  });

  test("only the treatments that are hidden change an answer", () => {
    const shown = shownFaqs(
      "manual-therapies",
      serviceFaqs["manual-therapies"]!,
      ["espira"],
      translator(enFaqs),
    );
    expect(shown[0]!.answer).toBe(enFaqs["manual-therapies"]["0"].answer);
  });

  test("a question naming a hidden treatment with no variant is left out, never shown naming it", () => {
    const t = translator({
      x: {
        "0": { question: "Q0", answer: "A0" },
        "1": { question: "Q1", answer: "names it" },
      },
    });
    expect(
      shownFaqs(
        "x",
        [
          { question: "", answer: "" },
          { question: "", answer: "", mentions: ["alure-duo"] },
        ],
        ["alure-duo"],
        t,
      ),
    ).toEqual([{ question: "Q0", answer: "A0" }]);
  });

  test("the three service pages show and mark up this one list", () => {
    const SITE = join(import.meta.dir, "../../(site)/[locale]/(page)");
    for (const path of [
      "wellness/manual-therapies",
      "wellness/facial-therapies",
      "medicine/intravenous-therapy",
    ]) {
      const source = readFileSync(join(SITE, path, "page.tsx"), "utf8");
      expect(source).toContain("shownFaqs(");
      expect(source).toContain("<JsonLd data={faqPageSchema(faqs)} />");
      expect(source).toContain("<ServiceFaq faqs={faqs} />");
    }
  });
});

describe("the facial list", () => {
  test("counts no rituals: the number changes when one is switched off", () => {
    for (const messages of [esWellness, enWellness]) {
      expect(messages.treatments.facialsSubtitle).not.toMatch(
        /\b(tres|cuatro|three|four)\b/i,
      );
    }
  });
});

describe("what a facial session looks like", () => {
  const step = treatments["facial-therapies"]!.sessionDetails.find(
    (d) => d.mentions,
  )!;

  test("the step that names Kinéa Signature has a wording without it, in both languages", () => {
    expect(step.mentions).toEqual(["kinea-signature"]);
    for (const messages of [esWellness, enWellness]) {
      const texts = (
        messages.treatments["facial-therapies"].sessionDetails as Record<
          string,
          { description: string; descriptionWithout?: string }
        >
      )[step.number]!;
      expect(texts.description).toMatch(/kin[ée]a/i);
      expect(texts.descriptionWithout).toBeDefined();
      expect(texts.descriptionWithout).not.toMatch(/kin[ée]a/i);
    }
  });

  test("the section picks it while the treatment is hidden", () => {
    const section = readFileSync(
      join(
        import.meta.dir,
        "../../components/sections/wellness/treatment/treatment-section.tsx",
      ),
      "utf8",
    );
    expect(section).toContain(
      "detail.mentions?.some((id) => hidden.includes(id))",
    );
    expect(section).toContain(
      "<SessionSection data={data} hidden={hiddenIds} />",
    );
  });
});
