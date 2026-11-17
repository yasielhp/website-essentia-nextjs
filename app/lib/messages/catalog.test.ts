import { describe, expect, it } from "bun:test";
import {
  LEGACY_TEMPLATES,
  MESSAGE_CATALOG,
  MESSAGE_KEYS,
  unknownVariables,
} from "./catalog";

describe("unknownVariables", () => {
  it("is empty when every token is offered", () => {
    expect(
      unknownVariables("booking_received", "Hola {{first_name}}, {{service}}"),
    ).toEqual([]);
  });

  it("is empty when the text has no token", () => {
    expect(unknownVariables("booking_received", "Hola, gracias")).toEqual([]);
  });

  it("names a token the message does not offer", () => {
    expect(
      unknownVariables("booking_received", "{{first_name}} {{nope}}"),
    ).toEqual(["nope"]);
  });

  it("names every unknown token once, in order of appearance", () => {
    expect(
      unknownVariables("booking_received", "{{b}} {{first_name}} {{a}} {{b}}"),
    ).toEqual(["b", "a"]);
  });

  it("reads tokens with spaces inside the braces", () => {
    expect(unknownVariables("booking_received", "{{ first_name }}")).toEqual(
      [],
    );
    expect(unknownVariables("booking_received", "{{ nope }}")).toEqual([
      "nope",
    ]);
  });

  it("flags a variable that belongs to another message", () => {
    expect(
      unknownVariables(
        "booking_cancelled",
        "Hola {{first_name}}, {{cancel_url}}",
      ),
    ).toEqual(["cancel_url"]);
    expect(unknownVariables("booking_confirmed", "{{cancel_url}}")).toEqual([]);
  });

  it("reads tokens the way the renderer does: digits and capitals count", () => {
    // The renderer swallows `{{First_Name}}` as an empty token, so it has to
    // be flagged here or the admin ships a blank where the name should be.
    expect(unknownVariables("booking_received", "{{First_Name}}")).toEqual([
      "First_Name",
    ]);
    expect(unknownVariables("booking_received", "{{name2}}")).toEqual([
      "name2",
    ]);
  });
});

describe("MESSAGE_CATALOG", () => {
  it("has one entry per key, and no key twice", () => {
    expect(new Set(MESSAGE_KEYS).size).toBe(MESSAGE_KEYS.length);
    expect(Object.keys(MESSAGE_CATALOG).sort()).toEqual(
      [...MESSAGE_KEYS].sort(),
    );
  });

  it("offers first_name in every message", () => {
    for (const key of MESSAGE_KEYS) {
      expect(MESSAGE_CATALOG[key].variables).toContain("first_name");
    }
  });

  it("never repeats a variable inside a message", () => {
    for (const key of MESSAGE_KEYS) {
      const { variables } = MESSAGE_CATALOG[key];
      expect(new Set(variables).size).toBe(variables.length);
    }
  });

  it("lets only the reminder be switched off", () => {
    const disable = MESSAGE_KEYS.filter((k) => MESSAGE_CATALOG[k].canDisable);
    expect(disable).toEqual(["booking_reminder"]);
  });

  it("offers a link variable exactly where a fixed block carries that link", () => {
    for (const key of MESSAGE_KEYS) {
      const { variables, fixed } = MESSAGE_CATALOG[key];
      expect(variables.includes("cancel_url")).toBe(
        fixed.includes("cancel_link"),
      );
      expect(variables.includes("consent_url")).toBe(
        fixed.includes("consent_button"),
      );
    }
  });

  it("allows WhatsApp only on messages tied to a booking", () => {
    // The WhatsApp sender finds the client through the booking, so a message
    // with no booking behind it has nobody to resolve a number from.
    for (const key of MESSAGE_KEYS) {
      if (MESSAGE_CATALOG[key].whatsappEligible) {
        expect(key.startsWith("booking_")).toBe(true);
      }
    }
  });

  it("allows WhatsApp only on the two instant confirmations the client opted in to hear about", () => {
    const eligible = MESSAGE_KEYS.filter(
      (k) => MESSAGE_CATALOG[k].whatsappEligible,
    );
    expect(eligible.sort()).toEqual(["booking_confirmed", "booking_paid"]);
  });

  it("the reminder is not one of them: its WhatsApp version is an appointment notice, a campaign", () => {
    expect(MESSAGE_CATALOG.booking_reminder.whatsappEligible).toBe(false);
    // The email reminder is untouched: it can still be switched off.
    expect(MESSAGE_CATALOG.booking_reminder.canDisable).toBe(true);
  });

  it("nothing that goes out on WhatsApp can be switched off", () => {
    for (const key of MESSAGE_KEYS) {
      const { whatsappEligible, canDisable } = MESSAGE_CATALOG[key];
      expect(whatsappEligible && canDisable).toBe(false);
    }
  });
});

describe("LEGACY_TEMPLATES", () => {
  it("maps every key to the code that sends it today", () => {
    for (const key of MESSAGE_KEYS) {
      const legacy = LEGACY_TEMPLATES[key];
      expect(legacy.file).toMatch(/^app\/emails\/templates\/[a-z-]+\.ts$/);
      expect(legacy.fn).toMatch(/Email$/);
    }
  });
});
