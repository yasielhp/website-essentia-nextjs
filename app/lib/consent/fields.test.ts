import { describe, expect, it } from "bun:test";
import {
  CONSENT_FIELDS,
  REQUIRED_IDS,
  missingRequired,
  sanitizeAnswers,
} from "./fields";

const allFalse = Object.fromEntries(REQUIRED_IDS.map((id) => [id, false]));

describe("missingRequired", () => {
  it("asks for all thirteen yes/no answers when nothing is filled", () => {
    expect(REQUIRED_IDS).toHaveLength(13);
    expect(missingRequired({})).toHaveLength(13);
  });

  it("is empty once every answer is a boolean", () => {
    expect(missingRequired(allFalse)).toEqual([]);
  });

  it("does not take a string for a yes", () => {
    expect(missingRequired({ ...allFalse, surgery: "yes" })).toEqual([
      "surgery",
    ]);
  });

  it("does not require the free-text zone to avoid", () => {
    expect(REQUIRED_IDS).not.toContain("avoidZone");
    expect(CONSENT_FIELDS.some((f) => f.id === "avoidZone")).toBe(true);
  });
});

describe("sanitizeAnswers", () => {
  it("keeps known answers and their details", () => {
    expect(
      sanitizeAnswers({
        surgery: true,
        surgeryDetail: " rodilla, 2024 ",
        avoidZone: "cuello",
      }),
    ).toEqual({
      surgery: true,
      surgeryDetail: "rodilla, 2024",
      avoidZone: "cuello",
    });
  });

  it("drops unknown keys, answers of the wrong type, and a detail with no yes", () => {
    expect(
      sanitizeAnswers({ hacker: "x", surgery: "yes", cancerDetail: "x" }),
    ).toEqual({});
  });

  it("cuts a long detail to 500 characters", () => {
    const out = sanitizeAnswers({ other: true, otherDetail: "a".repeat(900) });
    expect((out.otherDetail as string).length).toBe(500);
  });
});

describe("sanitizeAnswers · details", () => {
  it("keeps the detail of a yes and drops one typed beside a no", () => {
    const clean = sanitizeAnswers({
      surgery: true,
      surgeryDetail: "knee, 2024",
      cancer: false,
      cancerDetail: "typed, then negated",
    });
    expect(clean.surgeryDetail).toBe("knee, 2024");
    expect(clean.cancer).toBe(false);
    expect("cancerDetail" in clean).toBe(false);
  });
});
