import { describe, expect, it } from "bun:test";
import { toCampaignPhone } from "./phone";

describe("toCampaignPhone", () => {
  it.each(["600112233", "600 11 22 33", "+34 600 11 22 33", "0034600112233"])(
    "normalises %s to +34600112233",
    (raw) => {
      expect(toCampaignPhone(raw)).toBe("+34600112233");
    },
  );

  it("keeps a foreign number that carries its own country code", () => {
    expect(toCampaignPhone("+447911123456")).toBe("+447911123456");
  });

  it("accepts the edges the database accepts: 8 and 15 digits", () => {
    expect(toCampaignPhone("+12345678")).toBe("+12345678");
    expect(toCampaignPhone("+861234567890123")).toBe("+861234567890123");
    expect(toCampaignPhone("+123456789012345")).toBe("+123456789012345");
  });

  it("rejects a number shorter than the database accepts", () => {
    expect(toCampaignPhone("1234567")).toBeNull();
    expect(toCampaignPhone("+1234567")).toBeNull();
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
