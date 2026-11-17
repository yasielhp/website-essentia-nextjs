import { describe, expect, it } from "bun:test";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import type { Recipient } from "./audience-filter";
import {
  MAX_PARAM_LENGTH,
  paramsMatchTemplate,
  resolveParams,
} from "./whatsapp-params";

const recipient: Recipient = {
  id: "r",
  email: "a@b.c",
  firstName: "Ana",
  lastName: "Pérez",
  language: "es",
  phone: "+34600112233",
};

const field = (f: "first_name" | "last_name" | "service" | "post_title") =>
  ({ kind: "field", field: f }) satisfies WhatsAppParamSource;
const fixed = (value: string) =>
  ({ kind: "static", value }) satisfies WhatsAppParamSource;

describe("resolveParams", () => {
  it("takes names from the recipient, statics as written, the rest from vars", () => {
    expect(
      resolveParams(
        [field("first_name"), fixed("drenaje"), field("post_title")],
        recipient,
        { post_title: "Volvemos" },
      ),
    ).toEqual(["Ana", "drenaje", "Volvemos"]);
  });

  it("reads last_name from the recipient", () => {
    expect(resolveParams([field("last_name")], recipient)).toEqual(["Pérez"]);
  });

  it("turns an empty value into a dash: Meta rejects empty parameters", () => {
    expect(resolveParams([fixed("")], recipient)).toEqual(["—"]);
  });

  it("turns a null last name into a dash", () => {
    expect(
      resolveParams([field("last_name")], { ...recipient, lastName: null }),
    ).toEqual(["—"]);
  });

  it("turns a field of only whitespace into a dash", () => {
    expect(
      resolveParams([field("first_name")], {
        ...recipient,
        firstName: " \n\t ",
      }),
    ).toEqual(["—"]);
    expect(resolveParams([fixed("   ")], recipient)).toEqual(["—"]);
  });

  it("turns a missing var into a dash", () => {
    expect(resolveParams([field("service")], recipient, {})).toEqual(["—"]);
    expect(resolveParams([field("service")], recipient)).toEqual(["—"]);
  });

  it("flattens newlines and tabs: Meta rejects them in parameters", () => {
    expect(resolveParams([fixed("a\nb\tc\r\nd")], recipient)).toEqual([
      "a b c d",
    ]);
  });

  it("collapses runs of spaces and trims the ends: Meta rejects more than four", () => {
    expect(resolveParams([fixed("  a      b   ")], recipient)).toEqual(["a b"]);
  });

  it("normalises values that come from vars and the recipient too", () => {
    expect(
      resolveParams(
        [field("service"), field("first_name")],
        {
          ...recipient,
          firstName: "Ana\n\nMaría",
        },
        { service: "Drenaje\t  linfático" },
      ),
    ).toEqual(["Drenaje linfático", "Ana María"]);
  });

  it("cuts a value above the limit, leaving room under Meta's 1024", () => {
    const [out] = resolveParams([fixed("x".repeat(5000))], recipient);
    expect(out.length).toBe(MAX_PARAM_LENGTH);
    expect(MAX_PARAM_LENGTH).toBe(1000);
  });

  it("does not leave a trailing space where the cut falls", () => {
    const [out] = resolveParams(
      [fixed(`${"x".repeat(MAX_PARAM_LENGTH - 1)} tail`)],
      recipient,
    );
    expect(out).toBe("x".repeat(MAX_PARAM_LENGTH - 1));
  });

  it("does not split a character made of two code units", () => {
    const [out] = resolveParams([fixed("🌿".repeat(1500))], recipient);
    expect(Array.from(out).length).toBe(MAX_PARAM_LENGTH);
    expect(out).toBe("🌿".repeat(MAX_PARAM_LENGTH));
  });

  it("treats NBSP and U+2028 as whitespace", () => {
    expect(resolveParams([fixed("a\u00a0\u00a0b\u2028c")], recipient)).toEqual([
      "a b c",
    ]);
  });

  it("deletes zero-width characters and the byte order mark, not replaces them", () => {
    expect(
      resolveParams([fixed("a\u200Bb\u200C\u200Dc\uFEFFd")], recipient),
    ).toEqual(["abcd"]);
  });

  it("deletes other control characters", () => {
    expect(resolveParams([fixed("a\u0000b\u0007c")], recipient)).toEqual([
      "abc",
    ]);
  });

  it("turns a value of only invisible characters into a dash", () => {
    expect(
      resolveParams([fixed("\u200B\u200C\u200D\uFEFF\u0000")], recipient),
    ).toEqual(["—"]);
  });

  it("leaves a dash already in the value alone", () => {
    expect(resolveParams([fixed("—")], recipient)).toEqual(["—"]);
    expect(resolveParams([fixed("a — b")], recipient)).toEqual(["a — b"]);
  });

  it("does not throw on a null in vars: it reads as empty", () => {
    const vars = { service: null } as unknown as Record<string, string>;
    expect(resolveParams([field("service")], recipient, vars)).toEqual(["—"]);
  });

  it("stringifies a number that a jsonb column handed over", () => {
    const vars = { service: 42 } as unknown as Record<string, string>;
    expect(resolveParams([field("service")], recipient, vars)).toEqual(["42"]);
    expect(resolveParams([fixed(7 as unknown as string)], recipient)).toEqual([
      "7",
    ]);
  });

  it("reads an unknown field as empty, not from the object's prototype", () => {
    const odd = {
      kind: "field",
      field: "constructor",
    } as unknown as WhatsAppParamSource;
    expect(resolveParams([odd], recipient, {})).toEqual(["—"]);
  });

  it("returns one value per source, in order", () => {
    expect(resolveParams([], recipient)).toEqual([]);
    expect(
      resolveParams([fixed("1"), fixed("2"), fixed("3")], recipient),
    ).toEqual(["1", "2", "3"]);
  });
});

describe("paramsMatchTemplate", () => {
  it("is null when the number of sources is the template's", () => {
    expect(
      paramsMatchTemplate([fixed("a"), field("first_name")], 2),
    ).toBeNull();
    expect(paramsMatchTemplate([], 0)).toBeNull();
  });

  it("flags too few sources", () => {
    expect(paramsMatchTemplate([fixed("a")], 2)).toBe("paramCountMismatch");
  });

  it("flags too many sources", () => {
    expect(paramsMatchTemplate([fixed("a"), fixed("b")], 1)).toBe(
      "paramCountMismatch",
    );
    expect(paramsMatchTemplate([fixed("a")], 0)).toBe("paramCountMismatch");
  });
});
