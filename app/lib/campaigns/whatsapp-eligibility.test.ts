import { describe, expect, test } from "bun:test";
import {
  templateChoiceIssue,
  whatsappContentErrors,
  whatsappTemplateEligibility,
} from "./whatsapp-eligibility";
import { SOURCES, template } from "./whatsapp-fixtures";

describe("templateChoiceIssue", () => {
  test("an approved, supported template in the language is a choice", () => {
    expect(templateChoiceIssue(template(), "es")).toBeNull();
  });
  test("says why a template is not, in the order that matters", () => {
    expect(templateChoiceIssue(null, "es")).toBe("template_missing");
    expect(templateChoiceIssue(template({ status: "PENDING" }), "es")).toBe(
      "template_not_approved",
    );
    expect(
      templateChoiceIssue(
        template({ unsupported_reason: "media_header" }),
        "es",
      ),
    ).toBe("template_unsupported");
    expect(templateChoiceIssue(template({ language: "en" }), "es")).toBe(
      "template_language",
    );
  });
  test("a regional variant serves its language", () => {
    expect(
      templateChoiceIssue(template({ language: "es_ES" }), "es"),
    ).toBeNull();
    expect(templateChoiceIssue(template({ language: "en-US" }), "es")).toBe(
      "template_language",
    );
  });
  test("does not look at the parameters", () => {
    expect(templateChoiceIssue(template({ param_count: 9 }), "es")).toBeNull();
  });
});

describe("whatsappTemplateEligibility", () => {
  test("adds the parameter count to the choice", () => {
    expect(whatsappTemplateEligibility(template(), "es", SOURCES)).toBeNull();
    expect(whatsappTemplateEligibility(template(), "es", [])).toBe(
      "param_count",
    );
    expect(
      whatsappTemplateEligibility(template({ status: "REJECTED" }), "es", []),
    ).toBe("template_not_approved");
  });
});

describe("whatsappContentErrors", () => {
  test("nothing to say about a template that can go out", () => {
    expect(whatsappContentErrors(template(), "es", SOURCES)).toBeNull();
  });
  test("a template that cannot be sent is reported on the template field", () => {
    for (const missing of [null, template({ status: "PAUSED" })]) {
      expect(whatsappContentErrors(missing, "es", SOURCES)).toEqual({
        "content.whatsapp.templateId": "templateUnavailable",
      });
    }
    expect(
      whatsappContentErrors(template({ language: "en" }), "es", SOURCES),
    ).toEqual({
      "content.whatsapp.templateId": "templateUnavailable",
    });
  });
  test("a wrong number of parameters is reported on the parameters", () => {
    expect(whatsappContentErrors(template(), "es", [SOURCES[0]])).toEqual({
      "content.whatsapp.params": "paramCountMismatch",
    });
  });
});
