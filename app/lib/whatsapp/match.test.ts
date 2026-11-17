import { describe, expect, test } from "bun:test";
import { matchByPhone } from "@/lib/whatsapp/match";

const contacts = [
  { id: "a", phone: "600 11 22 33" },
  { id: "b", phone: "+34 600-112-233" },
  { id: "c", phone: "0034600112233" },
  { id: "d", phone: "611 99 88 77" },
  { id: "e", phone: null },
  { id: "f", phone: "abc" },
  // Too long for a campaign number: never matches.
  { id: "g", phone: "+1234567890123456" },
];

describe("matchByPhone", () => {
  test("every way of writing the number matches", () => {
    expect(matchByPhone("34600112233", contacts).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
  test("a different number matches only itself", () => {
    expect(matchByPhone("34611998877", contacts)).toEqual(["d"]);
  });
  test("no match, null phones and garbage give nothing", () => {
    expect(matchByPhone("34699000000", contacts)).toEqual([]);
    expect(matchByPhone("", contacts)).toEqual([]);
    expect(matchByPhone("abc", contacts)).toEqual([]);
  });
  test("a sender longer than a campaign number matches nothing", () => {
    expect(matchByPhone("1234567890123456", contacts)).toEqual([]);
  });
  test("several senders, each contact once", () => {
    expect(
      matchByPhone(
        ["34611998877", "34600112233", "34611998877"],
        contacts,
      ).sort(),
    ).toEqual(["a", "b", "c", "d"]);
  });
  test("a sender that is not a string is skipped", () => {
    expect(matchByPhone([7 as never, "34611998877"], contacts)).toEqual(["d"]);
  });
  test("the normaliser can be swapped", () => {
    expect(
      matchByPhone("34600112233", contacts, (raw) =>
        raw === "611 99 88 77" || raw === "+34600112233" ? "+X" : null,
      ),
    ).toEqual(["d"]);
  });
});
