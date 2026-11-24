import { describe, expect, it } from "bun:test";
import { formatAmountInput, parseEuroAmount } from "./parse-amount";

describe("parseEuroAmount", () => {
  const cases: [string, number | null][] = [
    ["1000", 1000],
    ["1.000", 1000],
    ["1.000,50", 1000.5],
    ["100,5", 100.5],
    ["99,99", 99.99],
    ["100,00", 100],
    ["12.345.678", 12345678],
    ["100.5", 100.5],
    ["99.99", 99.99],
    ["1,000.50", 1000.5],
    [" 100 € ", 100],
    ["100,", 100],
    ["0,5", 0.5],
    // Refused, never guessed:
    ["0,001", null],
    ["10,005", null],
    ["1,000", null],
    ["1.00.0", null],
    ["1,5,5", null],
    ["1.000,5.0", null],
    ["12,34.5", null],
    [",5", null],
    ["abc", null],
    ["", null],
    ["-5", null],
  ];
  for (const [input, expected] of cases) {
    it(`reads "${input}" as ${expected}`, () => {
      expect(parseEuroAmount(input)).toBe(expected);
    });
  }
});

describe("formatAmountInput", () => {
  it("writes the amount the way each language types it, and reads back the same", () => {
    expect(formatAmountInput(99.99, "es")).toBe("99,99");
    expect(formatAmountInput(1000, "es")).toBe("1000,00");
    expect(formatAmountInput(99.99, "en")).toBe("99.99");
    for (const locale of ["es", "en"] as const) {
      expect(parseEuroAmount(formatAmountInput(1234.5, locale))).toBe(1234.5);
    }
  });
});
