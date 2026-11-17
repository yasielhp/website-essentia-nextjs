import { describe, expect, test } from "bun:test";
import { startFromParams } from "./new-start";

describe("startFromParams", () => {
  test("a channel and a kind that go together are the start", () => {
    expect(startFromParams("whatsapp", "appointment")).toEqual({
      channel: "whatsapp",
      kind: "appointment",
    });
    expect(startFromParams("email", "standard")).toEqual({
      channel: "email",
      kind: "standard",
    });
    expect(startFromParams("whatsapp", "automated")).toEqual({
      channel: "whatsapp",
      kind: "automated",
    });
  });
  test("a kind the channel cannot be is ignored, whole: no half a start", () => {
    expect(startFromParams("email", "appointment")).toBeNull();
    expect(startFromParams("whatsapp", "split")).toBeNull();
    expect(startFromParams("whatsapp", "rss")).toBeNull();
  });
  test("an unknown channel or kind is ignored", () => {
    expect(startFromParams("sms", "standard")).toBeNull();
    expect(startFromParams("whatsapp", "nope")).toBeNull();
    expect(startFromParams("whatsapp", "constructor")).toBeNull();
    expect(startFromParams("WHATSAPP", "appointment")).toBeNull();
  });
  test("with one of the two missing, or none, there is no start", () => {
    expect(startFromParams(undefined, undefined)).toBeNull();
    expect(startFromParams("whatsapp", undefined)).toBeNull();
    expect(startFromParams(undefined, "appointment")).toBeNull();
    expect(startFromParams("", "")).toBeNull();
  });
  test("a repeated parameter (an array) is ignored", () => {
    expect(startFromParams(["whatsapp", "email"], "appointment")).toBeNull();
    expect(startFromParams("whatsapp", ["appointment"])).toBeNull();
  });
});
