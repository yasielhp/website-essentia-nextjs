import { describe, expect, test } from "bun:test";
import { saveStrictness } from "./save-mode";
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
