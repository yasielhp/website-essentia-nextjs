import { describe, expect, test } from "bun:test";
import en from "../../../../../messages/en/wellness.json";
import es from "../../../../../messages/es/wellness.json";
import {
  facialTreatments,
  manualTherapyTreatments,
} from "@/data/services-data";
import { minutesOf } from "@/lib/treatments/prices";

/**
 * The line under the title of a treatment card, and where each half of it
 * comes from. A card's price is its session type's, read from the database, so
 * no card may carry one in code or in a translation: the centre changes its
 * prices itself, and a figure typed here goes on saying the old one. These pin
 * that, and that no text is left behind once a card stops using it.
 */

type Card = Record<string, string>;
const facialCards = (messages: typeof es) =>
  messages.treatments.facialCards as Record<string, Card>;

describe("treatment cards: a length to find the price by", () => {
  test("every length a card shows is one plain length, so its session type can be found", () => {
    for (const treatment of [...manualTherapyTreatments, ...facialTreatments]) {
      for (const duration of treatment.durations ?? []) {
        expect(`${treatment.id}: ${minutesOf(duration)}`).not.toBe(
          `${treatment.id}: null`,
        );
      }
    }
  });

  test("every manual therapy card shows a length", () => {
    for (const treatment of manualTherapyTreatments) {
      expect(treatment.durations.length).toBeGreaterThan(0);
    }
  });
});

describe("facial cards: the price is not written anywhere", () => {
  const priced = facialTreatments.filter((f) => f.durations);
  const written = facialTreatments.filter((f) => !f.durations);

  test("the three rituals on sale take their price from their session type", () => {
    expect(priced.map((f) => f.id)).toEqual(["anesis", "aurum", "eleva"]);
  });

  test("a card priced from its session type has no line of its own left in the messages", () => {
    for (const messages of [es, en]) {
      for (const facial of priced) {
        expect(Object.keys(facialCards(messages)[facial.id]!).sort()).toEqual([
          "description",
          "title",
        ]);
      }
    }
  });

  test("a card with no length keeps the line written for it, in both languages", () => {
    // Kinéa Signature: its session type is switched off and its card states no
    // length to find one by, so it prints its own line until somebody decides
    // otherwise.
    expect(written.map((f) => f.id)).toEqual(["kinea-signature"]);
    for (const messages of [es, en]) {
      for (const facial of written) {
        expect(facialCards(messages)[facial.id]!.meta).toBeTruthy();
      }
    }
  });

  test("Spanish and English have the same cards with the same keys", () => {
    const shape = (messages: typeof es) =>
      Object.fromEntries(
        Object.entries(facialCards(messages)).map(([id, card]) => [
          id,
          Object.keys(card).sort(),
        ]),
      );
    expect(shape(es)).toEqual(shape(en));
    expect(Object.keys(facialCards(es)).sort()).toEqual(
      facialTreatments.map((f) => f.id).sort(),
    );
  });

  test("no price is kept in the treatments' data", () => {
    for (const facial of facialTreatments) {
      expect(JSON.stringify(facial)).not.toMatch(/€|\beur\b/i);
    }
  });
});
