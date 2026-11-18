import { describe, expect, test } from "bun:test";
import { MESSAGE_CATALOG, MESSAGE_KEYS, type FixedBlock } from "./catalog";
import {
  BLOCK_INFO,
  VARIABLE_KINDS,
  blockCards,
  variableKind,
  type VariableKind,
} from "./variable-kinds";

const everyVariable = [
  ...new Set(MESSAGE_KEYS.flatMap((key) => MESSAGE_CATALOG[key].variables)),
];
const everyBlock = [
  ...new Set(MESSAGE_KEYS.flatMap((key) => MESSAGE_CATALOG[key].fixed)),
];

describe("the kind of each variable", () => {
  test("every variable any message offers has a kind", () => {
    for (const name of everyVariable) {
      expect(variableKind(name)).not.toBeNull();
    }
  });

  test("the kinds are the ones the brief names", () => {
    expect(variableKind("first_name")).toBe("person");
    expect(variableKind("service")).toBe("service");
    expect(variableKind("session_type")).toBe("session");
    expect(variableKind("date")).toBe("date");
    expect(variableKind("expires_on")).toBe("date");
    expect(variableKind("time")).toBe("time");
    expect(variableKind("duration")).toBe("duration");
    expect(variableKind("amount_due")).toBe("money");
    expect(variableKind("amount_paid")).toBe("money");
    expect(variableKind("cancel_url")).toBe("link");
    expect(variableKind("consent_url")).toBe("link");
  });

  test("a name the catalogue does not offer has no kind", () => {
    expect(variableKind("nope")).toBeNull();
    expect(variableKind("constructor")).toBeNull();
  });

  test("the list of kinds is the one set every one of them belongs to", () => {
    const kinds = new Set<VariableKind>(
      everyVariable.map((v) => variableKind(v)!),
    );
    for (const kind of kinds) expect(VARIABLE_KINDS).toContain(kind);
  });
});

describe("the cards of the blocks the system adds", () => {
  test("every block the catalogue has is described", () => {
    for (const block of everyBlock) {
      expect(BLOCK_INFO[block as FixedBlock]).toBeDefined();
    }
  });

  test("a message's cards are its blocks, in the catalogue's order, and only its variables are named", () => {
    for (const key of MESSAGE_KEYS) {
      const def = MESSAGE_CATALOG[key];
      const cards = blockCards(def.fixed, def.variables);
      expect(cards.map((c) => c.block)).toEqual(def.fixed);
      for (const card of cards) {
        for (const name of card.variables) {
          expect(def.variables).toContain(name);
        }
      }
    }
  });

  test("two messages differ: the received one has the payment note and no location, the confirmed one the reverse", () => {
    const received = blockCards(
      MESSAGE_CATALOG.booking_received.fixed,
      MESSAGE_CATALOG.booking_received.variables,
    ).map((c) => c.block);
    const confirmed = blockCards(
      MESSAGE_CATALOG.booking_confirmed.fixed,
      MESSAGE_CATALOG.booking_confirmed.variables,
    ).map((c) => c.block);
    expect(received).toEqual(["details_card", "payment_note", "cancel_link"]);
    expect(confirmed).toEqual([
      "details_card",
      "location",
      "calendar_button",
      "consent_button",
      "cancel_link",
    ]);
  });

  test("the details card names the variables it fills, as far as the message offers them", () => {
    const cancelled = blockCards(
      MESSAGE_CATALOG.booking_cancelled.fixed,
      MESSAGE_CATALOG.booking_cancelled.variables,
    )[0];
    expect(cancelled.variables).toEqual(
      expect.arrayContaining(["service", "session_type", "date", "time"]),
    );
  });

  test("a link block names its link, a block with no data names no variable", () => {
    const confirmed = blockCards(
      MESSAGE_CATALOG.booking_confirmed.fixed,
      MESSAGE_CATALOG.booking_confirmed.variables,
    );
    expect(confirmed.find((c) => c.block === "cancel_link")!.variables).toEqual(
      ["cancel_url"],
    );
    expect(
      confirmed.find((c) => c.block === "consent_button")!.variables,
    ).toEqual(["consent_url"]);
    expect(confirmed.find((c) => c.block === "location")!.variables).toEqual(
      [],
    );
  });
});
