import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as client from "./client";
import * as phone from "./phone";
import { toCampaignPhone } from "./phone";

describe("phone.ts is safe to ship to the browser", () => {
  // A client component imports this file for `toCampaignPhone`. Whatever it
  // imports goes into the browser bundle with it, and it used to import
  // `client.ts`: the whole Meta client, there for one pure function.
  it("imports nothing, the Meta client least of all", () => {
    const source = readFileSync(join(import.meta.dir, "phone.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\bfrom\s+["']/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bimport\s*\(/);
    expect(source).not.toMatch(/process\.env/);
  });

  it("holds `toE164`, and the Meta client hands out the very same function", () => {
    expect(typeof phone.toE164).toBe("function");
    expect(client.toE164).toBe(phone.toE164);
  });
});

describe("toE164", () => {
  it.each(["600112233", "600 11 22 33", "600-112-233", "0034600112233"])(
    "gives %s the Spanish prefix",
    (raw) => {
      expect(phone.toE164(raw)).toBe("+34600112233");
    },
  );

  it("leaves a number that is already international with its own country code", () => {
    expect(phone.toE164("+376 312 345")).toBe("+376312345");
    expect(phone.toE164("00447911123456")).toBe("+447911123456");
  });

  it("answers null for nothing, and for what is too short to be a mobile", () => {
    for (const raw of [null, undefined, "", "   ", "abc", "1234567"]) {
      expect(phone.toE164(raw)).toBeNull();
    }
  });
});

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
