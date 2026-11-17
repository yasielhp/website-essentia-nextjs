import { describe, expect, test } from "bun:test";
import {
  isOptOutMessage,
  isOptOutText,
  matchOptOut,
} from "@/lib/whatsapp/optout";

describe("isOptOutText", () => {
  test("accepts the two opt-out words", () => {
    expect(isOptOutText("STOP")).toBe(true);
    expect(isOptOutText("BAJA")).toBe(true);
  });
  test("ignores case, surrounding spaces and trailing punctuation", () => {
    expect(isOptOutText("Stop.")).toBe(true);
    expect(isOptOutText(" baja! ")).toBe(true);
    expect(isOptOutText("stop!!!")).toBe(true);
    expect(isOptOutText("¡Baja!")).toBe(true);
  });
  test("ignores accents", () => {
    expect(isOptOutText("BÁJA")).toBe(true);
    expect(isOptOutText("stóp")).toBe(true);
  });
  test("does not treat CANCELAR as an opt-out: it usually means a booking", () => {
    expect(isOptOutText("CANCELAR")).toBe(false);
    expect(isOptOutText("cancelar")).toBe(false);
  });
  test("a sentence that merely contains the word is not an opt-out", () => {
    expect(isOptOutText("no quiero parar")).toBe(false);
    expect(isOptOutText("dar de baja")).toBe(false);
    expect(isOptOutText("stop please")).toBe(false);
  });
  test("a body that is not a string never throws and is not an opt-out", () => {
    for (const body of [123, {}, [], ["STOP"], true, null, undefined]) {
      expect(isOptOutText(body)).toBe(false);
    }
  });
  test("a long text is never an opt-out, even when it wraps the word", () => {
    expect(isOptOutText(`${" ".repeat(30)}STOP`)).toBe(false);
    expect(isOptOutText("STOP".padEnd(21, "."))).toBe(false);
    expect(isOptOutText("STOP".padEnd(20, "."))).toBe(true);
  });
  test("empty or missing text is not an opt-out", () => {
    expect(isOptOutText("")).toBe(false);
    expect(isOptOutText("   ")).toBe(false);
    expect(isOptOutText(undefined)).toBe(false);
    expect(isOptOutText(null)).toBe(false);
  });
});

describe("matchOptOut", () => {
  const contacts = [
    { id: "a", phone: "600 11 22 33" },
    { id: "b", phone: "600-112-233" },
    { id: "c", phone: "+34 600 11 22 33" },
    { id: "d", phone: "0034600112233" },
    { id: "e", phone: "34600112233" },
    { id: "f", phone: "611 99 88 77" },
    { id: "g", phone: null },
    { id: "h", phone: "abc" },
    { id: "i", phone: "" },
  ];

  test("every way of writing the same number matches", () => {
    expect(matchOptOut("34600112233", contacts).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });
  test("a different number matches only itself", () => {
    expect(matchOptOut("34611998877", contacts)).toEqual(["f"]);
  });
  test("a number nobody has matches nothing", () => {
    expect(matchOptOut("34699000000", contacts)).toEqual([]);
  });
  test("null or garbage phones never match", () => {
    expect(matchOptOut("34600112233", contacts)).not.toContain("g");
    expect(matchOptOut("34600112233", contacts)).not.toContain("h");
    expect(matchOptOut("34600112233", contacts)).not.toContain("i");
  });
  test("a sender that is not a usable number matches nothing", () => {
    expect(matchOptOut("", contacts)).toEqual([]);
    expect(matchOptOut("abc", contacts)).toEqual([]);
  });
  test("several senders at once, each one's contacts exactly once", () => {
    expect(
      matchOptOut(
        ["34611998877", "34600112233", "34611998877"],
        contacts,
      ).sort(),
    ).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
  test("a sender that is not a string matches nothing", () => {
    expect(matchOptOut([123 as never, "34611998877"], contacts)).toEqual(["f"]);
  });
  test("accepts a sender that already carries a plus sign", () => {
    expect(matchOptOut("+34600112233", contacts)).toHaveLength(5);
  });
});

describe("isOptOutMessage", () => {
  test("a typed STOP or BAJA", () => {
    expect(isOptOutMessage({ type: "text", text: { body: "STOP" } })).toBe(
      true,
    );
    expect(isOptOutMessage({ type: "text", text: { body: " Baja. " } })).toBe(
      true,
    );
  });
  test("a template's quick-reply button, by its label or its payload", () => {
    expect(
      isOptOutMessage({
        type: "button",
        button: { text: "BAJA", payload: "optout-1" },
      }),
    ).toBe(true);
    expect(
      isOptOutMessage({
        type: "button",
        button: { text: "No me escribas", payload: "STOP" },
      }),
    ).toBe(true);
  });
  test("an interactive reply, button or list row, by its title", () => {
    expect(
      isOptOutMessage({
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: { id: "1", title: "Stop" },
        },
      }),
    ).toBe(true);
    expect(
      isOptOutMessage({
        type: "interactive",
        interactive: {
          type: "list_reply",
          list_reply: { id: "row-3", title: "Baja" },
        },
      }),
    ).toBe(true);
  });
  test("the same exact-word rule on a button: a longer label is not a STOP", () => {
    expect(
      isOptOutMessage({
        type: "button",
        button: { text: "Darme de baja", payload: "x" },
      }),
    ).toBe(false);
    expect(
      isOptOutMessage({
        type: "button",
        button: { text: "Cancelar", payload: "cancelar" },
      }),
    ).toBe(false);
    expect(
      isOptOutMessage({
        type: "interactive",
        interactive: { button_reply: { id: "1", title: "Confirmar cita" } },
      }),
    ).toBe(false);
  });
  test("each type reads its own fields only", () => {
    // An image with a stray `text` is not a typed STOP.
    expect(isOptOutMessage({ type: "image", text: { body: "STOP" } })).toBe(
      false,
    );
    expect(isOptOutMessage({ type: "text", button: { text: "STOP" } })).toBe(
      false,
    );
  });
  test("a body that is not the promised shape never throws", () => {
    for (const message of [
      null,
      undefined,
      "STOP",
      7,
      [],
      { type: "button" },
      { type: "button", button: "STOP" },
      { type: "button", button: { text: 5, payload: {} } },
      { type: "interactive", interactive: null },
      { type: "interactive", interactive: { button_reply: "STOP" } },
      { type: "text", text: null },
    ]) {
      expect(isOptOutMessage(message)).toBe(false);
    }
  });
});
