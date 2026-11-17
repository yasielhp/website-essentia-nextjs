import { describe, expect, test } from "bun:test";
import { PAUSE_TO_SAVE, refusalOfSave, saveStrictness } from "./save-mode";
import type { CampaignStatus } from "@/types/campaign";

describe("how strictly a save is checked", () => {
  test("a save that is not a draft is always checked in full", () => {
    for (const status of [null, "draft", "active", "scheduled"] as const) {
      expect(saveStrictness(false, status)).toBe("full");
    }
  });
  test("a draft of a new campaign, or of one that is not going out, is loose", () => {
    const quiet: (CampaignStatus | null)[] = [
      null,
      "draft",
      "paused",
      "cancelled",
      "failed",
    ];
    for (const status of quiet)
      expect(saveStrictness(true, status)).toBe("draft");
  });
  test("a 'draft' save of an active or scheduled campaign is checked in full: it goes out as saved", () => {
    expect(saveStrictness(true, "active")).toBe("full");
    expect(saveStrictness(true, "scheduled")).toBe("full");
  });
});

describe("what a refused save answers", () => {
  test("a new or quiet draft that is invalid is 'invalid', never a request to pause", () => {
    expect(refusalOfSave(true, "draft")).toBe("invalid");
  });
  test("a loose save of a live campaign that is incomplete asks for a pause", () => {
    expect(refusalOfSave(true, "full")).toBe(PAUSE_TO_SAVE);
  });
  test("a send that is invalid is 'invalid'", () => {
    expect(refusalOfSave(false, "full")).toBe("invalid");
  });
});
