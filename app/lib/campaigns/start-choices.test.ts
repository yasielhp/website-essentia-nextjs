import { describe, expect, test } from "bun:test";
import { templatesFor } from "./templates";
import { BLANK_START, startChoices } from "./start-choices";

const TEMPLATES = [
  { id: "newsletter", kinds: ["standard", "split"] as const },
  { id: "welcome", kinds: ["autoresponder"] as const },
  { id: "birthday", kinds: ["dateBased"] as const },
];

describe("startChoices: what the starting-point select offers", () => {
  test("the blank page first, then every template, in order", () => {
    const out = startChoices(TEMPLATES, "standard");
    expect(out.map((c) => (c.type === "blank" ? "blank" : c.id))).toEqual([
      "blank",
      "newsletter",
      "welcome",
      "birthday",
    ]);
  });

  test("a template made for this kind is suggested; the others are still there", () => {
    const out = startChoices(TEMPLATES, "autoresponder");
    const flags = Object.fromEntries(
      out.flatMap((c) =>
        c.type === "template" ? [[c.id, c.recommended]] : [],
      ),
    );
    expect(flags).toEqual({
      newsletter: false,
      welcome: true,
      birthday: false,
    });
  });

  test("with no templates there is still the blank page", () => {
    expect(startChoices([], "standard")).toEqual([{ type: "blank" }]);
  });

  test("the blank option's value cannot be a template's id", () => {
    for (const kind of [
      "standard",
      "automated",
      "autoresponder",
      "split",
      "rss",
      "dateBased",
    ] as const) {
      for (const template of templatesFor(kind))
        expect(template.id).not.toBe(BLANK_START);
    }
  });
});
