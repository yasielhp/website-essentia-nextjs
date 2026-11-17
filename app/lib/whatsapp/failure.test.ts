import { describe, expect, test } from "bun:test";
import { describeMetaFailure, metaFailureKind } from "@/lib/whatsapp/failure";

describe("metaFailureKind", () => {
  test("131026 means the number cannot be reached", () => {
    expect(metaFailureKind(131026)).toBe("unreachable");
  });
  test("rate and frequency limits are transient", () => {
    for (const code of [131049, 131048, 130429, 131056, 131000]) {
      expect(metaFailureKind(code)).toBe("transient");
    }
  });
  test("any other code is other", () => {
    expect(metaFailureKind(131047)).toBe("other");
    expect(metaFailureKind(132001)).toBe("other");
    expect(metaFailureKind(0)).toBe("other");
  });
  test("a missing or malformed code is other", () => {
    expect(metaFailureKind(undefined)).toBe("other");
    expect(metaFailureKind(null)).toBe("other");
    expect(metaFailureKind(Number.NaN)).toBe("other");
    expect(metaFailureKind({})).toBe("other");
    expect(metaFailureKind("")).toBe("other");
    expect(metaFailureKind("abc")).toBe("other");
  });
  test("a negative code is other", () => {
    expect(metaFailureKind(-131026)).toBe("other");
    expect(metaFailureKind("-131049")).toBe("other");
  });
  test("a string with surrounding spaces still counts", () => {
    expect(metaFailureKind(" 131026 ")).toBe("unreachable");
    expect(metaFailureKind("\t131049\n")).toBe("transient");
    expect(metaFailureKind("   ")).toBe("other");
  });
  test("a code that arrives as a string still counts", () => {
    expect(metaFailureKind("131026")).toBe("unreachable");
    expect(metaFailureKind("131049")).toBe("transient");
  });
});

describe("describeMetaFailure", () => {
  test("the code, then the details", () => {
    expect(
      describeMetaFailure({
        code: 131026,
        title: "Message undeliverable",
        message: "(#131026) Message undeliverable",
        error_data: { details: "Message Undeliverable." },
      }),
    ).toBe("131026: Message Undeliverable.");
  });
  test("falls back from details to message to title", () => {
    expect(describeMetaFailure({ code: 1, message: "m", title: "t" })).toBe(
      "1: m",
    );
    expect(describeMetaFailure({ code: 1, title: "t" })).toBe("1: t");
  });
  test("empty details fall through to the message", () => {
    expect(
      describeMetaFailure({
        code: 9,
        message: "the message",
        error_data: { details: "" },
      }),
    ).toBe("9: the message");
  });
  test("a long text is cut to 300 characters, code included", () => {
    const out = describeMetaFailure({
      code: 131026,
      message: "x".repeat(1000),
    });
    expect(out.length).toBe(300);
    expect(out.startsWith("131026: xxx")).toBe(true);
  });
  test("a text of exactly 300 characters is kept whole", () => {
    const message = "y".repeat(300 - "5: ".length);
    expect(describeMetaFailure({ code: 5, message })).toBe(`5: ${message}`);
  });
  test("the cut never leaves half of an emoji", () => {
    // "5: " leaves 297 units, an odd number, so unit 300 falls mid-emoji.
    const out = describeMetaFailure({ code: 5, message: "😀".repeat(200) });
    expect(out).toBe(`5: ${"😀".repeat(148)}`);
    expect(out.length).toBe(299);
  });
  test("a code alone, and text alone", () => {
    expect(describeMetaFailure({ code: 131049 })).toBe("131049");
    expect(describeMetaFailure({ message: "boom" })).toBe("boom");
  });
  test("nothing to say still says something", () => {
    expect(describeMetaFailure(undefined)).toBe("WhatsApp error");
    expect(describeMetaFailure({})).toBe("WhatsApp error");
  });
  test("a non-string field is ignored", () => {
    expect(
      describeMetaFailure({ code: 5, message: 42 as never, title: "t" }),
    ).toBe("5: t");
  });
});
