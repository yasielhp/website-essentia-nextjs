import { describe, expect, test } from "bun:test";
import {
  cardPrice,
  pricesOfTreatment,
  toTierPrices,
} from "@/lib/treatments/prices";

describe("toTierPrices: what a session type costs, as the booking form shows it", () => {
  test("the centre's price, which is the one the form's own list shows", () => {
    expect(
      toTierPrices([{ label: "Espira", price_eur: 63, price_center_eur: 70 }]),
    ).toEqual([{ label: "Espira", priceEur: 70 }]);
  });

  test("the web price when the centre's is not set", () => {
    expect(
      toTierPrices([{ label: "Pulse", price_eur: 85, price_center_eur: null }]),
    ).toEqual([{ label: "Pulse", priceEur: 85 }]);
  });

  test("the database hands numerics over as text: they are read as numbers", () => {
    expect(
      toTierPrices([
        { label: "Soma", price_eur: "140.00", price_center_eur: "140.00" },
      ]),
    ).toEqual([{ label: "Soma", priceEur: 140 }]);
  });

  test("a session type with no name, or no price to show, is left out", () => {
    expect(
      toTierPrices([
        { label: null, price_eur: 70, price_center_eur: 70 },
        { label: "  ", price_eur: 70, price_center_eur: 70 },
        { label: "Sin precio", price_eur: null, price_center_eur: null },
        { label: "Cero", price_eur: 0, price_center_eur: 0 },
        { label: "Negativo", price_eur: -5, price_center_eur: null },
        { label: "Texto", price_eur: "abc", price_center_eur: null },
      ]),
    ).toEqual([]);
  });

  test("what is not a list of rows is no prices at all", () => {
    for (const rows of [null, undefined, "rows", 42, {}]) {
      expect(toTierPrices(rows)).toEqual([]);
    }
    expect(toTierPrices([null, "row", 7])).toEqual([]);
  });
});

describe("pricesOfTreatment: the price of a treatment's card", () => {
  const PRICES = [
    { label: "Espira", priceEur: 70 },
    { label: "Drenaje Linfático Avanzado", priceEur: 100 },
  ];

  test("found by the name of the session type, as a tier meets its treatment everywhere else", () => {
    expect(pricesOfTreatment(PRICES, "Espira")).toEqual([70]);
    expect(pricesOfTreatment(PRICES, "  drenaje linfático avanzado ")).toEqual([
      100,
    ]);
  });

  test("a treatment with no session type on sale has no price: nothing is shown for it", () => {
    expect(pricesOfTreatment(PRICES, "Alure Duo")).toEqual([]);
    expect(pricesOfTreatment([], "Espira")).toEqual([]);
  });

  test("one sold in several lengths shows each price once, in the order they were read", () => {
    expect(
      pricesOfTreatment(
        [
          { label: "Espira", priceEur: 70 },
          { label: "Pulse", priceEur: 85 },
          { label: "espira", priceEur: 110 },
          { label: "Espira", priceEur: 70 },
        ],
        "Espira",
      ),
    ).toEqual([70, 110]);
  });
});

describe("cardPrice: written as the facial cards write theirs", () => {
  // The space before the euro sign is the one the locale puts there (a no-break
  // space), so the number and its sign never end up on two lines.
  const plain = (text: string) => text.replace(/ /g, " ");

  test("whole euros carry no decimals: '70 €' in Spanish, '€70' in English", () => {
    expect(plain(cardPrice(70, "es"))).toBe("70 €");
    expect(cardPrice(70, "en")).toBe("€70");
    expect(plain(cardPrice(350, "es"))).toBe("350 €");
  });

  test("a price with cents keeps both of them", () => {
    expect(plain(cardPrice(72.5, "es"))).toBe("72,50 €");
    expect(cardPrice(72.5, "en")).toBe("€72.50");
  });
});
