import { describe, expect, it } from "bun:test";
import { toCampaignPhone } from "./phone";

describe("toCampaignPhone", () => {
  it.each(["600112233", "600 11 22 33", "+34 600 11 22 33", "0034600112233"])(
    "normalises %s to +34600112233",
    (raw) => {
      expect(toCampaignPhone(raw)).toBe("+34600112233");
    },
  );

  it("rejects a number shorter than the database accepts", () => {
    expect(toCampaignPhone("1234567")).toBeNull();
  });

  it("rejects a number longer than the database accepts", () => {
    expect(toCampaignPhone("+1234567890123456")).toBeNull();
  });

  it("rejects text and empty values", () => {
    expect(toCampaignPhone("no phone")).toBeNull();
    expect(toCampaignPhone("")).toBeNull();
    expect(toCampaignPhone(null)).toBeNull();
    expect(toCampaignPhone(undefined)).toBeNull();
  });
});
